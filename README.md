# Pomotime - Simple & Beautiful Pomodoro Timer

A clean and intuitive Pomodoro timer Chrome extension designed to help you focus better and work more efficiently.

## Features

- 🍅 Classic Pomodoro Technique (25-min work, 5-min break, 15-min long break)
- 🎨 Beautiful, modern UI with color-coded phases
- ⚙️ Fully customizable timer durations
- 🔔 Smart notifications and visual feedback
- 🚀 Right-click context menu for quick actions
- 💾 Timer persistence across browser sessions

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/erandakarachchi/pomotime.git
cd pomotime
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` folder

### Scripts

- `npm run build` - Build the extension for production
- `npm run watch` - Build and watch for changes during development

## Chrome Web Store Deployment

### Step 1: Prepare Your Extension

1. **Build the production version:**
```bash
npm run build
```

2. **Create a ZIP file** of the `dist` folder contents:
   - Navigate to the `dist` folder
   - Select all files and folders inside `dist`
   - Create a ZIP archive (e.g., `pomotime-v1.3.0.zip`)
   - **Important:** ZIP the contents, not the `dist` folder itself

3. **Verify the ZIP contains:**
   - `manifest.json`
   - `service_worker.js`
   - HTML, CSS, and JS files
   - `icons/` folder with all icon files

### Step 2: Chrome Developer Dashboard Setup

1. **Register as a Chrome Web Store developer:**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - Sign in with your Google account
   - Pay the one-time $5 registration fee

2. **Create a new item:**
   - Click "Add new item"
   - Upload your ZIP file
   - Choose "Public" visibility (or "Unlisted" for testing)

### Step 3: Complete Store Listing

#### **Store Listing Tab:**

**Basic Information:**
- **App name:** Pomotime
- **Summary:** Simple & Beautiful Pomodoro Timer for focused productivity
- **Category:** Productivity
- **Language:** English (or your preferred language)

**Detailed Description:**
```
Boost your productivity with Pomotime, a clean and intuitive Pomodoro timer extension designed to help you focus better and work more efficiently.

KEY FEATURES

Classic Pomodoro Technique
• 25-minute focused work sessions
• 5-minute short breaks
• 15-minute long breaks after every 4 work cycles
• Automatic cycle progression

Beautiful, Modern Design
• Clean, distraction-free interface
• Color-coded phases (Red for work, Blue for breaks, Green for achievements)
• Smooth animations and modern styling
• Professional visual feedback

Fully Customizable
• Adjust work session duration (1-120 minutes)
• Customize break lengths (1-120 minutes)
• Set your preferred number of cycles before long breaks
• Personalize your productivity rhythm

Smart Notifications
• Desktop notifications for session transitions
• Visual badge counter on extension icon
• Non-intrusive alerts that keep you on track

HOW TO USE
1. Click the extension icon to start your work session
2. Work for 25 minutes (or your custom duration)
3. Take a 5-minute break when prompted
4. After 4 cycles, enjoy a longer 15-minute break
5. Repeat and watch your productivity soar!

Perfect for students, professionals, freelancers, and anyone looking to improve their focus and productivity.

No account required • Works offline • Completely free
```

#### **Assets Required:**

**Screenshots (1280x800 pixels):**
- Screenshot 1: Main timer interface during work session
- Screenshot 2: Settings page showing customization options
- Screenshot 3: Break completion screen
- Screenshot 4: Large break achievement screen
- Optional: Screenshot 5: Context menu options

**Icon (128x128 pixels):**
- Use your `icon128.png` file
- Ensure it's clear and recognizable at small sizes

**Small Tile (440x280 pixels):**
- Create a promotional tile featuring your app name and icon
- Use your brand colors (red theme)

### Step 4: Privacy & Additional Information

#### **Privacy Tab:**
- **Single Purpose:** Pomodoro timer for productivity
- **Permission Justification:**
  - `notifications`: For timer completion alerts
  - `storage`: To save user settings and timer state
  - `alarms`: For timer countdown functionality
  - `contextMenus`: For right-click quick actions

- **Data Usage:** All data stored locally on user's device, no external servers

#### **Distribution Tab:**
- **Regions:** Select all regions or specific markets
- **Pricing:** Free

### Step 5: Review and Publish

1. **Review all information** for accuracy
2. **Submit for review** (can take 1-7 days)
3. **Respond to any feedback** from Chrome Web Store team
4. **Publish** once approved

### Step 6: Post-Launch

#### **Monitor Performance:**
- Check reviews and ratings regularly
- Monitor user feedback for feature requests
- Track download statistics

#### **Updates:**
```bash
# When releasing updates:
1. Update version in manifest.json and package.json
2. npm run build
3. Create new ZIP from dist folder
4. Upload to Chrome Web Store Developer Dashboard
5. Update store listing if needed
6. Submit for review
```

### Troubleshooting Common Issues

**Upload Errors:**
- Ensure ZIP contains manifest.json in root
- Check all required icons are present
- Verify manifest.json syntax is valid

**Review Rejections:**
- Review Chrome Web Store policies
- Ensure all permissions are justified
- Check for any policy violations in description

**Store Listing:**
- Use high-quality screenshots
- Write clear, honest descriptions
- Include relevant keywords naturally

### Version History

- **v1.3.0** - Enhanced timer logic, modern UI design, production-ready release
- **v1.2.0** - Core Pomodoro functionality with customizable settings
- **v1.1.0** - Initial release with basic timer features

### Support

For issues or questions:
- GitHub Issues: [Repository Issues](https://github.com/erandakarachchi/pomotime/issues)
- Developer Contact: [Your Email]

### License

[Your chosen license - e.g., MIT, GPL, etc.]
