# Install Node.js First

**Node.js is required to run this project but is not currently installed on your system.**

## Quick Install Steps:

1. **Download Node.js**
   - Go to: https://nodejs.org/
   - Download the LTS version (recommended)
   - Choose the Windows Installer (.msi)

2. **Install Node.js**
   - Run the installer
   - Accept all defaults
   - Make sure "Add to PATH" is checked
   - Click "Install"

3. **Restart Your Terminal**
   - Close this PowerShell/Command Prompt window
   - Open a NEW terminal window
   - This is important so the PATH updates

4. **Verify Installation**
   ```powershell
   node --version
   npm --version
   ```
   Both commands should show version numbers.

5. **Then Come Back Here**
   - Once Node.js is installed, I can help you set up the database and start the server!

## Alternative: Use Chocolatey (if you have it)

```powershell
choco install nodejs-lts
```

## After Installing Node.js

Once Node.js is installed, I'll help you:
1. Install project dependencies
2. Set up the database
3. Start the development server
4. Open it in your browser at http://localhost:3000
