import pyvjoy
import time
from flask import Flask, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

# Add basic security with an API key
API_KEY = os.environ.get('CONTROLLER_API_KEY', 'api_key_here')

# Initialize vJoy device
j = pyvjoy.VJoyDevice(1)  # Device ID 1

# Button mappings (vJoy buttons are 1-based)
BUTTON_MAPPINGS = {
    'a': 1,
    'b': 2,
    'select': 3,
    'start': 4
}

# Axis center position (half of 0x8000)
AXIS_CENTER = 0x4000
AXIS_MAX = 0x8000
AXIS_MIN = 0x0

def verify_api_key():
    auth_header = request.headers.get('Authorization')
    if not auth_header or auth_header != f'Bearer {API_KEY}':
        return False
    return True

@app.route('/input', methods=['POST'])
def handle_input():
    if not verify_api_key():
        return {'status': 'error', 'message': 'Unauthorized'}, 401

    data = request.json
    button = data.get('button', '').lower()
    
    try:
        if button in ['up', 'down', 'left', 'right']:
            # Handle D-pad inputs
            if button == 'up':
                j.set_axis(pyvjoy.HID_USAGE_Y, AXIS_MIN)
            elif button == 'down':
                j.set_axis(pyvjoy.HID_USAGE_Y, AXIS_MAX)
            elif button == 'left':
                j.set_axis(pyvjoy.HID_USAGE_X, AXIS_MIN)
            elif button == 'right':
                j.set_axis(pyvjoy.HID_USAGE_X, AXIS_MAX)
            
            # Reset axis after short delay
            time.sleep(0.1)
            if button in ['up', 'down']:
                j.set_axis(pyvjoy.HID_USAGE_Y, AXIS_CENTER)
            else:
                j.set_axis(pyvjoy.HID_USAGE_X, AXIS_CENTER)

        elif button in BUTTON_MAPPINGS:
            # Handle button inputs
            button_id = BUTTON_MAPPINGS[button]
            j.set_button(button_id, 1)
            time.sleep(0.1)
            j.set_button(button_id, 0)
        
        return {'status': 'ok', 'button': button}
    
    except Exception as e:
        print(f"Error processing input: {e}")
        return {'status': 'error', 'message': str(e)}, 500

@app.route('/reset', methods=['POST'])
def reset_controller():
    if not verify_api_key():
        return {'status': 'error', 'message': 'Unauthorized'}, 401

    try:
        # Reset all axes to center
        j.set_axis(pyvjoy.HID_USAGE_X, AXIS_CENTER)
        j.set_axis(pyvjoy.HID_USAGE_Y, AXIS_CENTER)
        
        # Reset all buttons
        for button_id in BUTTON_MAPPINGS.values():
            j.set_button(button_id, 0)
            
        return {'status': 'ok'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 500

if __name__ == '__main__':
    # Reset controller state on startup
    j.reset()
    print("Virtual controller initialized. Running on http://localhost:5000")
    app.run(port=5000) 
