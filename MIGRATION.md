# Migration Guide

## Overview
This guide helps you migrate from the original codebase to the refactored version.

## Step-by-Step Migration

### 1. Install Dependencies
```bash
npm install
```

### 2. Update HTML Files
All HTML files have been updated to use ES6 modules:
- Replace `<script src="script.js"></script>` with `<script type="module" src="src/app.js"></script>`
- Remove individual script includes (storage.js, firebase.js)

### 3. Code Changes

#### Global Variables → Module Imports
**Before:**
```javascript
// Global access
TabStorage.saveTab(data);
```

**After:**
```javascript
import { LocalStorage } from './modules/storage/LocalStorage.js';
LocalStorage.saveTab(data);
```

#### Settings Access
**Before:**
```javascript
function getSettings() {
    return {
        includeTiming: document.getElementById('include-timing').checked,
        // ...
    };
}
```

**After:**
```javascript
import { TabConverter } from './modules/converter/TabConverter.js';
const settings = TabConverter.getSettingsFromElements(settingsElements);
```

#### Notifications
**Before:**
```javascript
alert('Tab saved!');
```

**After:**
```javascript
import { notificationManager } from './modules/ui/components/NotificationManager.js';
notificationManager.success('Tab saved!');
```

### 4. Firebase Integration

The Firebase code needs to be refactored into a module. Create `src/modules/auth/FirebaseAuth.js`:

```javascript
import { firebaseConfig } from '../../config.js';
import { LocalStorage } from '../storage/LocalStorage.js';
import { notificationManager } from '../ui/components/NotificationManager.js';

export class FirebaseAuth {
    // Move firebase.js content here as a class
}
```

### 5. Testing Your Changes

1. Test tab conversion with various formats
2. Test save/load functionality
3. Test Firebase sync (if enabled)
4. Test with screen readers
5. Verify keyboard navigation

### 6. Common Issues

#### Module Not Found
- Ensure all import paths are correct
- Use relative paths starting with './'
- File extensions are required

#### Firebase Not Working
- Update Firebase configuration in `src/config.js`
- Ensure Firebase SDK is loaded before modules

#### LocalStorage Issues
- Clear browser cache and local storage
- Check for storage quota errors

## Backward Compatibility

### Data Migration
Existing saved tabs will work without changes. The storage format remains the same.

### URLs
Tab loading URLs (`converter.html?load=tab_id`) continue to work.

### Settings
User settings are preserved and will be loaded automatically.

## Benefits of Refactoring

1. **Maintainability**: Easier to add features and fix bugs
2. **Testing**: Can unit test individual modules
3. **Performance**: Better code splitting and loading
4. **Type Safety**: Ready for TypeScript migration
5. **Documentation**: Better code documentation

## Next Steps

1. Run the development server to test
2. Update any custom modifications
3. Test thoroughly with assistive technology
4. Deploy using `npm run build`

## Support

If you encounter issues during migration:
1. Check the browser console for errors
2. Verify all files are in the correct locations
3. Ensure npm dependencies are installed
4. Clear browser cache and try again
