# Accessible Guitar Tabs - Refactored Version

## Overview
This is a refactored version of the Accessible Guitar Tabs web application. The application converts guitar tablature into screen reader-friendly sequential note descriptions, making guitar tabs accessible for blind and visually impaired musicians.

## Refactoring Changes

### 1. **Module System**
- Migrated from global scripts to ES6 modules
- Proper import/export structure
- Better code organization and encapsulation

### 2. **Project Structure**
```
src/
├── modules/
│   ├── converter/
│   │   ├── TabConverter.js
│   │   ├── parsers/
│   │   │   ├── ChordParser.js
│   │   │   ├── StandardTabParser.js
│   │   │   └── TechniqueParser.js
│   │   └── formatters/
│   │       └── OutputFormatter.js
│   ├── storage/
│   │   └── LocalStorage.js
│   ├── auth/
│   │   └── FirebaseAuth.js (to be created)
│   └── ui/
│       ├── components/
│       │   └── NotificationManager.js
│       └── pages/
│           └── MyTabsPage.js
├── utils/
│   ├── constants.js
│   ├── helpers.js
│   └── validators.js
├── config.js
└── app.js
```

### 3. **Key Improvements**

#### Code Organization
- **Separation of Concerns**: Each module has a specific responsibility
- **Reusable Components**: Common functionality extracted to utility modules
- **Consistent Patterns**: Standardized error handling and validation

#### New Features
- **NotificationManager**: Centralized notification system with screen reader support
- **Enhanced Validation**: Comprehensive input validation
- **Configuration Management**: Centralized configuration with environment support
- **Better Error Handling**: Consistent error messages and recovery

#### Code Quality
- **JSDoc Comments**: Complete documentation for all functions
- **ES6+ Features**: Modern JavaScript syntax and features
- **Constants**: All magic strings moved to constants
- **Helper Functions**: Reusable utilities for common operations

### 4. **Build Configuration**
- **Vite**: Modern build tool for fast development
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Jest**: Testing framework (ready for tests)

### 5. **Accessibility Enhancements**
- Improved screen reader announcements
- Better keyboard navigation
- Proper ARIA labels and roles
- Focus management

## Getting Started

### 🚀 Quick Deployment to GitHub Pages

**Want to deploy this app? See [SIMPLE_SETUP.md](SIMPLE_SETUP.md) for a 5-minute setup!**

GitHub will automatically build and deploy your app every time you push changes.

### Development Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

### Running Tests
```bash
npm test
```

### Code Quality
```bash
npm run lint
npm run format
```

## Features

### Tab Conversion
- **Chord Charts**: Converts chord definitions (e.g., "F: 1-3-3-2-1-1")
- **Standard Tablature**: Handles 6, 7, and 8 string tabs with or without string labels
- **Extended Range Guitars**: Full support for 7-string and 8-string guitars
- **Techniques**: Recognizes hammer-ons, pull-offs, bends, slides, etc.
- **Annotations**: Preserves timing, lyrics, and other tab annotations

### Storage
- **Local Storage**: Saves tabs locally in the browser
- **Cloud Sync**: Optional Firebase integration for cross-device sync
- **Import/Export**: JSON format for sharing tabs

### Accessibility
- **Screen Reader Optimized**: Clear, sequential descriptions
- **Keyboard Navigation**: Full keyboard support
- **Customizable Output**: Verbose or compact formats
- **ARIA Support**: Proper labeling and announcements

## Configuration

Edit `src/config.js` to customize:
- Feature flags
- Storage limits
- UI settings
- Parsing rules

## Firebase Setup (Optional)

For cloud sync functionality:

1. Create a Firebase project
2. Update `src/config.js` with your Firebase credentials
3. Enable Authentication and Firestore in Firebase Console

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Screen Readers: JAWS, NVDA, VoiceOver tested

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Built for the blind and visually impaired musician community
- Inspired by the need for accessible music notation
- Thanks to all contributors and testers
