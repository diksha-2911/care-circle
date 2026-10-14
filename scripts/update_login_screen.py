"""Remove duplicate login-screen token registration after Task 3 integration.

Run from the repository root:
    python care-circle-task3/scripts/update_login_screen.py
"""
from pathlib import Path

path = Path("app/src/screens/LoginScreen.tsx")
if not path.is_file():
    raise SystemExit(
        "Could not find app/src/screens/LoginScreen.tsx. Run this script from the repository root."
    )

text = path.read_text(encoding="utf-8")
original = text
text = text.replace(
    "import { registerForPushNotifications } from '../services/notifications';\n", ""
)
text = text.replace(
    "import { saveDeviceToken } from '../services/deviceTokens';\n", ""
)

old_block = '''    const user = data.user;

    if (user) {
      try {
        const token = await registerForPushNotifications(user.id);

        if (token) {
          await saveDeviceToken(user.id, token);
          console.log('Device token registered successfully');
        }
      } catch (tokenError) {
        console.error('Failed to register device token:', tokenError);
      }
    }
'''
new_block = '''    // CareCircleContext registers the device token after auth state changes,
    // including when an existing session is restored on app startup.
'''
if old_block in text:
    text = text.replace(old_block, new_block, 1)
elif "CareCircleContext registers the device token after auth state changes" not in text:
    raise SystemExit(
        "Could not find the expected post-login token block. No file was changed; "
        "remove the old registerForPushNotifications/saveDeviceToken block manually."
    )

if text == original:
    print("LoginScreen already updated; no changes made.")
else:
    path.write_text(text, encoding="utf-8")
    print("Updated LoginScreen.tsx; token registration is now owned by CareCircleContext.")
