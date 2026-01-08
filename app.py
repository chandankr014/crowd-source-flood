import os
import json
import hmac
import hashlib
import secrets
import random
import jwt
from functools import wraps
from datetime import datetime, timedelta
from pathlib import Path
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_from_directory, render_template, make_response, redirect
import requests
from PIL import Image

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 31536000  # 1 year cache for static files

@app.after_request
def add_headers(response):
    # Security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    # Cache control for static files
    if request.path.startswith('/static/'):
        response.headers['Cache-Control'] = 'public, max-age=31536000'
    return response

# Setup directories
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / 'crowd_data'
SUBMISSIONS_DIR = DATA_DIR / 'submissions'
IMAGES_DIR = DATA_DIR / 'images'
THUMBNAILS_DIR = DATA_DIR / 'thumbnails'
INTEL_DIR = DATA_DIR / 'intel'
VOLUNTEERS_DIR = DATA_DIR / 'volunteers'
SCRAPED_NEWS_DIR = DATA_DIR / 'scraped_news'

for d in [DATA_DIR, SUBMISSIONS_DIR, IMAGES_DIR, THUMBNAILS_DIR, INTEL_DIR, VOLUNTEERS_DIR, SCRAPED_NEWS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Load config from .env
from dotenv import load_dotenv
load_dotenv()

ADMIN_USER = os.getenv('ADMIN_USER', 'admin')
ADMIN_PASS = os.getenv('ADMIN_PASS', 'admin')
CAPTCHA_SECRET = os.getenv('CAPTCHA_SECRET', 'airesq')
JWT_SECRET = os.getenv('JWT_SECRET', secrets.token_hex(32))  # JWT signing secret
RECAPTCHA_SECRET = os.getenv('RECAPTCHA_PRIVATE_KEY', '')  # Google reCAPTCHA secret
X_BEARER_TOKEN = os.getenv('X_BEARER_TOKEN', '')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '')
OPENROUTER_MODEL = os.getenv('OPENROUTER_MODEL', 'openrouter/auto')

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def hmac_of(s):
    return hmac.new(CAPTCHA_SECRET.encode(), s.encode(), hashlib.sha256).hexdigest()

def check_auth(username, password):
    return username == ADMIN_USER and password == ADMIN_PASS

def create_thumbnail(image_path, thumbnail_path, size=(300, 300)):
    """Create a thumbnail for the given image"""
    try:
        img = Image.open(image_path)
        img.thumbnail(size, Image.Resampling.LANCZOS)
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        img.save(thumbnail_path, 'JPEG', quality=85, optimize=True)
        return True
    except Exception as e:
        print(f"Thumbnail creation error: {e}")
        return False

def requires_jwt_auth(f):
    """JWT-based authentication decorator"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get('admin_token')
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        try:
            jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired, please login again'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated

# Keep old requires_auth for backward compatibility during transition
def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # First try JWT from cookie
        token = request.cookies.get('admin_token')
        if token:
            try:
                jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
                return f(*args, **kwargs)
            except:
                pass
        # Fall back to Basic Auth
        auth = request.authorization
        if not auth or not check_auth(auth.username, auth.password):
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

# Language support
SUPPORTED_LANGUAGES = ['en', 'hn', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'ur']

def template_exists(template_name):
    """Check if a template file exists"""
    template_path = Path(app.template_folder) / template_name
    return template_path.exists()

@app.route('/<lang>/')
@app.route('/<lang>/index.html')
def lang_index(lang):
    """Serve language-specific index page"""
    if lang in SUPPORTED_LANGUAGES and lang != 'en':
        template = f'{lang}/index.html'
        if template_exists(template):
            return render_template(template)
    return redirect('/')

@app.route('/<lang>/admin.html')
def lang_admin(lang):
    """Serve language-specific admin page"""
    if lang in SUPPORTED_LANGUAGES and lang != 'en':
        template = f'{lang}/admin.html'
        if template_exists(template):
            return render_template(template)
    return redirect('/admin')

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Admin login endpoint - returns JWT token in httpOnly cookie"""
    try:
        data = request.get_json() or {}
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        if not check_auth(username, password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Create JWT token with 1 hour expiration
        token = jwt.encode({
            'user': username,
            'exp': datetime.utcnow() + timedelta(hours=1)
        }, JWT_SECRET, algorithm='HS256')
        
        response = make_response(jsonify({'ok': True, 'message': 'Login successful'}))
        response.set_cookie(
            'admin_token', 
            token, 
            httponly=True, 
            secure=False,  # Set to True in production with HTTPS
            samesite='Lax',
            max_age=3600  # 1 hour
        )
        return response
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'error': 'Server error'}), 500

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    """Admin logout - clears the auth cookie"""
    response = make_response(jsonify({'ok': True, 'message': 'Logged out'}))
    response.delete_cookie('admin_token')
    return response

@app.route('/api/captcha')
def captcha():
    a = random.randint(10, 99)
    b = random.randint(10, 99)
    token = hmac_of(str(a + b))
    return jsonify({'a': a, 'b': b, 'token': token})

@app.route('/api/submit', methods=['POST'])
def submit():
    try:
        name = request.form.get('name', '').strip()
        phone = request.form.get('phone', '').strip()
        street = request.form.get('street', '').strip()
        zone = request.form.get('zone', '').strip()
        ward = request.form.get('ward', '').strip()
        vehicle_type = request.form.get('vehicle_type', '').strip()
        flood_depth_cm = request.form.get('flood_depth_cm', '').strip()
        remarks = request.form.get('remarks', '').strip()
        gps_lat = request.form.get('gps_lat', '').strip()
        gps_lon = request.form.get('gps_lon', '').strip()
        gps_accuracy = request.form.get('gps_accuracy', '').strip()
        captcha_answer = request.form.get('captcha_answer', '').strip()
        captcha_token = request.form.get('captcha_token', '').strip()

        # Name and phone are optional - no validation needed
        
        # Flood depth is optional, but validate if provided
        depth_num = 0
        if flood_depth_cm:
            try:
                depth_num = int(flood_depth_cm)
                if depth_num < 0 or depth_num > 200:
                    depth_num = 0
            except ValueError:
                depth_num = 0

        # reCAPTCHA verification (required)
        recaptcha_token = request.form.get('g-recaptcha-response', '').strip()
        if not recaptcha_token:
            return jsonify({'error': 'Please complete the reCAPTCHA verification'}), 400
        
        if RECAPTCHA_SECRET:
            recaptcha_response = requests.post('https://www.google.com/recaptcha/api/siteverify', data={
                'secret': RECAPTCHA_SECRET,
                'response': recaptcha_token
            })
            if not recaptcha_response.json().get('success'):
                return jsonify({'error': 'reCAPTCHA verification failed. Please try again.'}), 400

        # Generate timestamp and random string for submission ID
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        random_str = secrets.token_hex(4)
        
        # Photo is optional
        image_filename = None
        thumbnail_filename = None
        if 'photo' in request.files:
            file = request.files['photo']
            if file.filename != '' and allowed_file(file.filename):
                # Save original image
                ext = Path(file.filename).suffix
                image_filename = f"img_{timestamp}_{random_str}{ext}"
                image_path = IMAGES_DIR / image_filename
                file.save(str(image_path))
                
                # Generate thumbnail
                thumbnail_filename = f"thumb_{timestamp}_{random_str}.jpg"
                thumbnail_path = THUMBNAILS_DIR / thumbnail_filename
                create_thumbnail(str(image_path), str(thumbnail_path))

        # Create submission
        submission_id = f"{timestamp}_{random_str}"
        submission = {
            'id': submission_id,
            'name': name,
            'phone': phone,
            'street': street,
            'zone': zone,
            'ward': ward,
            'vehicle_type': vehicle_type,
            'flood_depth_cm': depth_num,
            'remarks': remarks,
            'gps': {
                'lat': float(gps_lat) if gps_lat else None,
                'lon': float(gps_lon) if gps_lon else None,
                'accuracy': float(gps_accuracy) if gps_accuracy else None
            },
            'image_path': f'crowd_data/images/{image_filename}' if image_filename else None,
            'thumbnail_path': f'crowd_data/thumbnails/{thumbnail_filename}' if thumbnail_filename else None,
            'received_at': datetime.now().isoformat(),
            'user_agent': request.headers.get('User-Agent', '')
        }

        # Save submission JSON
        submission_file = SUBMISSIONS_DIR / f"{submission_id}.json"
        with open(submission_file, 'w', encoding='utf-8') as f:
            json.dump(submission, f, indent=2)

        return jsonify({'ok': True, 'id': submission_id})

    except Exception as e:
        import traceback
        print(f"Submit error: {e}")
        print(traceback.format_exc())
        return jsonify({'error': 'Server error occurred. Please try again.'}), 500

@app.route('/crowd_data/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(IMAGES_DIR, filename)

@app.route('/crowd_data/thumbnails/<path:filename>')
def serve_thumbnail(filename):
    """Serve thumbnail images for faster admin panel loading"""
    return send_from_directory(THUMBNAILS_DIR, filename)

@app.route('/api/admin/submissions', methods=['GET'])
@requires_auth
def admin_submissions():
    try:
        # Get filter parameter: all, valid, invalid, pending
        filter_type = request.args.get('filter', 'all').lower()
        
        files = sorted(SUBMISSIONS_DIR.glob('*.json'), key=lambda x: x.stat().st_mtime, reverse=True)
        items = []
        for f in files:
            with open(f, 'r', encoding='utf-8') as fp:
                obj = json.load(fp)
                status = obj.get('verification_status', 'pending')
                
                # Apply filter
                if filter_type != 'all' and status != filter_type:
                    continue
                
                items.append({
                    'id': obj['id'],
                    'name': obj['name'],
                    'phone': obj['phone'],
                    'ward': obj.get('ward', ''),
                    'zone': obj.get('zone', ''),
                    'street': obj.get('street', ''),
                    'vehicle_type': obj.get('vehicle_type', ''),
                    'flood_depth_cm': obj['flood_depth_cm'],
                    'remarks': obj.get('remarks', ''),
                    'received_at': obj['received_at'],
                    'image_path': obj.get('image_path'),
                    'thumbnail_path': obj.get('thumbnail_path'),
                    'gps': obj.get('gps', {}),
                    'verification_status': status
                })
        return jsonify({'count': len(items), 'items': items})
    except Exception as e:
        print(f"List error: {e}")
        return jsonify({'error': 'Server error'}), 500

@app.route('/api/admin/submission/<submission_id>', methods=['DELETE'])
@requires_auth
def delete_submission(submission_id):
    """Delete a submission and its associated images"""
    try:
        submission_file = SUBMISSIONS_DIR / f"{submission_id}.json"
        if not submission_file.exists():
            return jsonify({'error': 'Submission not found'}), 404
        
        # Load submission to get image paths
        with open(submission_file, 'r', encoding='utf-8') as f:
            submission = json.load(f)
        
        # Delete original image if exists
        if submission.get('image_path'):
            image_file = BASE_DIR / submission['image_path']
            if image_file.exists():
                image_file.unlink()
        
        # Delete thumbnail if exists
        if submission.get('thumbnail_path'):
            thumb_file = BASE_DIR / submission['thumbnail_path']
            if thumb_file.exists():
                thumb_file.unlink()
        
        # Delete submission JSON
        submission_file.unlink()
        
        return jsonify({'ok': True, 'deleted': submission_id})
    except Exception as e:
        print(f"Delete error: {e}")
        return jsonify({'error': 'Server error'}), 500

@app.route('/api/admin/export.json', methods=['GET'])
@requires_auth
def admin_export_json():
    try:
        files = SUBMISSIONS_DIR.glob('*.json')
        items = []
        for f in files:
            with open(f, 'r', encoding='utf-8') as fp:
                items.append(json.load(fp))
        return jsonify(items)
    except Exception as e:
        print(f"Export JSON error: {e}")
        return jsonify({'error': 'Server error'}), 500

@app.route('/api/admin/export.csv', methods=['GET'])
@requires_auth
def admin_export_csv():
    try:
        import csv
        from io import StringIO
        
        files = SUBMISSIONS_DIR.glob('*.json')
        items = []
        for f in files:
            with open(f, 'r', encoding='utf-8') as fp:
                items.append(json.load(fp))
        
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['id', 'name', 'phone', 'street', 'zone', 'ward', 'vehicle_type', 
                        'flood_depth_cm', 'remarks', 'gps_lat', 'gps_lon', 'gps_accuracy', 
                        'image_path', 'received_at'])
        
        for item in items:
            writer.writerow([
                item['id'], item['name'], item['phone'], item.get('street', ''),
                item.get('zone', ''), item.get('ward', ''), item.get('vehicle_type', ''),
                item['flood_depth_cm'], item.get('remarks', ''),
                item.get('gps', {}).get('lat', ''), item.get('gps', {}).get('lon', ''),
                item.get('gps', {}).get('accuracy', ''), item['image_path'], item['received_at']
            ])
        
        return output.getvalue(), 200, {'Content-Type': 'text/csv', 
                                        'Content-Disposition': 'attachment; filename=submissions.csv'}
    except Exception as e:
        print(f"Export CSV error: {e}")
        return jsonify({'error': 'Server error'}), 500

@app.route('/api/admin/crawl', methods=['POST'])
@requires_auth
def admin_crawl():
    try:
        if not X_BEARER_TOKEN:
            return jsonify({'error': 'X_BEARER_TOKEN not configured'}), 400
        
        data = request.get_json() or {}
        hashtags = data.get('hashtags', ['#flood', '#urbanflood'])
        query = ' OR '.join(hashtags)
        
        url = f"https://api.twitter.com/2/tweets/search/recent?query={query}&tweet.fields=created_at,geo,lang&max_results=50"
        headers = {'Authorization': f'Bearer {X_BEARER_TOKEN}'}
        
        response = requests.get(url, headers=headers)
        if not response.ok:
            return jsonify({'error': 'X API error', 'detail': response.text}), response.status_code
        
        tw_data = response.json()
        tweets = [t for t in tw_data.get('data', []) if t.get('lang') == 'en']
        
        # Summarize with OpenRouter
        summary = summarize_tweets_openrouter(tweets)
        
        # Save intelligence
        intel_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(4)}"
        intel = {
            'id': intel_id,
            'source': 'x_search_recent',
            'query': hashtags,
            'collected_at': datetime.now().isoformat(),
            'tweets': tweets,
            'summary': summary
        }
        
        intel_file = INTEL_DIR / f"x_intel_{intel_id}.json"
        with open(intel_file, 'w', encoding='utf-8') as f:
            json.dump(intel, f, indent=2)
        
        return jsonify({'ok': True, 'saved': f'crowd_data/intel/x_intel_{intel_id}.json'})
    
    except Exception as e:
        print(f"Crawl error: {e}")
        return jsonify({'error': 'Server error'}), 500

def summarize_tweets_openrouter(tweets):
    try:
        if not OPENROUTER_API_KEY:
            return {'error': 'OPENROUTER_API_KEY not configured'}
        
        system = 'You are assisting disaster-response with concise extraction from social posts.'
        text = '\n'.join([f"- {t['text']}" for t in tweets])
        prompt = f"""Extract structured flood insights from posts. Return JSON with keys: 
        areas (array of strings), roads_impacted (array strings), depths_cm (array numbers if mentioned), 
        severity (low/medium/high), summary (string). Input posts:\n{text}"""
        
        response = requests.post(
            'https://api.openrouter.ai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {OPENROUTER_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': OPENROUTER_MODEL,
                'messages': [
                    {'role': 'system', 'content': system},
                    {'role': 'user', 'content': prompt}
                ],
                'temperature': 0.2
            }
        )
        
        if not response.ok:
            return {'error': 'OpenRouter error', 'detail': response.text}
        
        data = response.json()
        content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
        
        try:
            return json.loads(content)
        except:
            return {'raw': content}
    
    except Exception as e:
        return {'error': str(e)}

@app.route('/health')
def health():
    return jsonify({'ok': True})

# Volunteer Registration
@app.route('/api/volunteer/register', methods=['POST'])
def volunteer_register():
    try:
        data = request.get_json() or {}
        username = data.get('username', '').strip()
        phone = data.get('phone', '').strip()
        skills = data.get('skills', [])
        availability = data.get('availability', '').strip()
        
        if not username or not phone:
            return jsonify({'error': 'Username and phone are required'}), 400
        
        phone_digits = ''.join(filter(str.isdigit, phone))
        if len(phone_digits) < 10:
            return jsonify({'error': 'Valid phone number required'}), 400
        
        volunteer_id = f"vol_{datetime.now().strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(4)}"
        volunteer = {
            'id': volunteer_id,
            'username': username,
            'phone': phone,
            'skills': skills,
            'availability': availability,
            'registered_at': datetime.now().isoformat(),
            'status': 'active'
        }
        
        volunteer_file = VOLUNTEERS_DIR / f"{volunteer_id}.json"
        with open(volunteer_file, 'w', encoding='utf-8') as f:
            json.dump(volunteer, f, indent=2)
        
        return jsonify({'ok': True, 'id': volunteer_id})
    except Exception as e:
        print(f"Volunteer register error: {e}")
        return jsonify({'error': 'Server error'}), 500

@app.route('/api/volunteer/login', methods=['POST'])
def volunteer_login():
    try:
        data = request.get_json() or {}
        phone = data.get('phone', '').strip()
        
        if not phone:
            return jsonify({'error': 'Phone number required'}), 400
        
        # Find volunteer by phone
        for f in VOLUNTEERS_DIR.glob('*.json'):
            with open(f, 'r', encoding='utf-8') as fp:
                vol = json.load(fp)
                if vol.get('phone') == phone:
                    return jsonify({'ok': True, 'volunteer': vol})
        
        return jsonify({'error': 'Volunteer not found'}), 404
    except Exception as e:
        print(f"Volunteer login error: {e}")
        return jsonify({'error': 'Server error'}), 500

# Admin: Verify submission
@app.route('/api/admin/verify/<submission_id>', methods=['POST'])
@requires_auth
def verify_submission(submission_id):
    try:
        data = request.get_json() or {}
        status = data.get('status', '').strip()  # 'valid' or 'invalid'
        
        if status not in ['valid', 'invalid']:
            return jsonify({'error': 'Status must be valid or invalid'}), 400
        
        submission_file = SUBMISSIONS_DIR / f"{submission_id}.json"
        if not submission_file.exists():
            return jsonify({'error': 'Submission not found'}), 404
        
        with open(submission_file, 'r', encoding='utf-8') as f:
            submission = json.load(f)
        
        submission['verification_status'] = status
        submission['verified_at'] = datetime.now().isoformat()
        
        with open(submission_file, 'w', encoding='utf-8') as f:
            json.dump(submission, f, indent=2)
        
        return jsonify({'ok': True, 'status': status})
    except Exception as e:
        print(f"Verify error: {e}")
        return jsonify({'error': 'Server error'}), 500

# Admin: Get volunteers list
@app.route('/api/admin/volunteers', methods=['GET'])
@requires_auth
def admin_volunteers():
    try:
        files = sorted(VOLUNTEERS_DIR.glob('*.json'), key=lambda x: x.stat().st_mtime, reverse=True)
        items = []
        for f in files:
            with open(f, 'r', encoding='utf-8') as fp:
                vol = json.load(fp)
                items.append({
                    'id': vol['id'],
                    'username': vol.get('username', ''),
                    'phone': vol.get('phone', ''),
                    'skills': vol.get('skills', []),
                    'availability': vol.get('availability', ''),
                    'registered_at': vol.get('registered_at', ''),
                    'status': vol.get('status', 'active')
                })
        return jsonify({'count': len(items), 'items': items})
    except Exception as e:
        print(f"Volunteers list error: {e}")
        return jsonify({'error': 'Server error'}), 500

# Admin: Get single submission
@app.route('/api/admin/submission/<submission_id>', methods=['GET'])
@requires_auth
def get_submission(submission_id):
    try:
        submission_file = SUBMISSIONS_DIR / f"{submission_id}.json"
        if not submission_file.exists():
            return jsonify({'error': 'Submission not found'}), 404
        
        with open(submission_file, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    except Exception as e:
        print(f"Get submission error: {e}")
        return jsonify({'error': 'Server error'}), 500

# AI Analysis Endpoints - Proxy to external API
AI_API_BASE = os.getenv('AI_API_BASE', 'http://127.0.0.1:5001')

@app.route('/api/admin/ai/search', methods=['POST'])
@requires_auth
def ai_search():
    """Proxy search request to external AI API"""
    try:
        data = request.get_json() or {}
        query = data.get('query', '')
        max_urls = data.get('max_urls', 4)
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        response = requests.post(
            f'{AI_API_BASE}/api/search',
            json={'query': query, 'max_urls': max_urls},
            headers={'Content-Type': 'application/json'},
            timeout=60
        )
        
        return jsonify(response.json()), response.status_code
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'AI API service is not available. Make sure it is running on port 5001.'}), 503
    except Exception as e:
        print(f"AI Search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/ai/extract', methods=['POST'])
@requires_auth
def ai_extract():
    """Proxy extract request to external AI API"""
    try:
        data = request.get_json() or {}
        urls = data.get('urls', [])
        
        if not urls:
            return jsonify({'error': 'URLs are required'}), 400
        
        response = requests.post(
            f'{AI_API_BASE}/api/extract',
            json={'urls': urls},
            headers={'Content-Type': 'application/json'},
            timeout=120
        )
        
        return jsonify(response.json()), response.status_code
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'AI API service is not available. Make sure it is running on port 5001.'}), 503
    except Exception as e:
        print(f"AI Extract error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/ai/news/save', methods=['POST'])
@requires_auth
def save_scraped_news():
    """Save scraped news to storage"""
    try:
        data = request.get_json() or {}
        news_items = data.get('news_items', [])
        query = data.get('query', 'Unknown query')
        source_urls = data.get('source_urls', [])
        
        if not news_items:
            return jsonify({'error': 'No news items to save'}), 400
        
        news_id = f"news_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(4)}"
        news_record = {
            'id': news_id,
            'query': query,
            'source_urls': source_urls,
            'news_items': news_items,
            'scraped_at': datetime.now().isoformat(),
            'item_count': len(news_items)
        }
        
        news_file = SCRAPED_NEWS_DIR / f"{news_id}.json"
        with open(news_file, 'w', encoding='utf-8') as f:
            json.dump(news_record, f, indent=2)
        
        return jsonify({'ok': True, 'id': news_id, 'saved_count': len(news_items)})
    except Exception as e:
        print(f"Save news error: {e}")
        return jsonify({'error': 'Server error'}), 500

@app.route('/api/admin/ai/news', methods=['GET'])
@requires_auth
def get_saved_news():
    """Get all saved scraped news records"""
    try:
        files = sorted(SCRAPED_NEWS_DIR.glob('*.json'), key=lambda x: x.stat().st_mtime, reverse=True)
        items = []
        for f in files:
            with open(f, 'r', encoding='utf-8') as fp:
                record = json.load(fp)
                items.append({
                    'id': record['id'],
                    'query': record.get('query', ''),
                    'scraped_at': record.get('scraped_at', ''),
                    'item_count': record.get('item_count', 0),
                    'news_items': record.get('news_items', [])
                })
        return jsonify({'count': len(items), 'items': items})
    except Exception as e:
        print(f"Get saved news error: {e}")
        return jsonify({'error': 'Server error'}), 500

@app.route('/api/admin/ai/news/<news_id>', methods=['DELETE'])
@requires_auth
def delete_saved_news(news_id):
    """Delete a saved news record"""
    try:
        news_file = SCRAPED_NEWS_DIR / f"{news_id}.json"
        if not news_file.exists():
            return jsonify({'error': 'News record not found'}), 404
        
        news_file.unlink()
        return jsonify({'ok': True, 'deleted': news_id})
    except Exception as e:
        print(f"Delete news error: {e}")
        return jsonify({'error': 'Server error'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8005, debug=True)
    