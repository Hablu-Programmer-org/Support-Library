# Branding Guidelines

Support Library is built by **Hablu Programmer** (https://hablu-programmer.com). This document outlines branding requirements for forks and distributions.

## Attribution Requirements

If you distribute a modified version of Support Library, you must:

1. **Retain the "Powered by Hablu Programmer" attribution** in the UI footer
2. **Include a link to https://hablu-programmer.com** in your documentation/README
3. **Not imply endorsement** by Hablu Programmer of your fork/distribution
4. **Not use the Hablu Programmer name/logo** to promote your fork without permission

## Brand Assets

### Logo
- **Location**: `public/logo.png`
- **Usage**: Displayed in top navigation bar and login page
- **Modification**: You may replace with your own logo
- **Attribution**: If keeping original logo, must retain attribution link

### Color Scheme
- **Primary**: Cyan (`#06b6d4`) → Violet (`#8b5cf6`) gradient
- **Dark mode default**: Slate 950 (`#020617`)
- **CSS Variables** (in `app/globals.css`):
  ```css
  --brand-gradient: linear-gradient(to right, #06b6d4, #8b5cf6);
  --brand-text: transparent background-clip-text bg-brand-gradient;
  --brand-bg: bg-brand-gradient;
  ```

### Typography
- **Font**: Inter (via `next/font/google`)
- **Weights**: 400, 500, 600, 700
- **Variable**: `--font-sans`

## UI Components with Branding

| Component | Location | Branding Elements |
|-----------|----------|-------------------|
| Login page | `app/login/page.tsx` | Logo, "Hablu Support Library" text, brand gradient button |
| Top bar | `components/layout/topbar.tsx` | Logo, "Hablu Support Library" text, brand gradient accent |
| Landing page | `app/page.tsx` | "Hablu Programmer Staff Tool" badge, brand gradient buttons |
| Mobile sheet | `components/layout/account-sheet.tsx` | Logo in account header |

## Customization Guide

### Replace Logo
```bash
# Replace public/logo.png with your logo (recommended: 499x339, transparent background)
cp your-logo.png public/logo.png
```

### Update App Name
```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: "Your Support Library",
  description: "Your description",
};

// components/layout/topbar.tsx
<span className="text-slate-900 dark:text-white">Your Name</span>
<span className="brand-text">Support Library</span>

// app/login/page.tsx
<h1>Your <span className="brand-text">Support Library</span></h1>
```

### Customize Colors
```css
/* app/globals.css */
:root {
  --brand-gradient: linear-gradient(to right, YOUR_COLOR_1, YOUR_COLOR_2);
}
```

### Remove Hablu Attribution (if permitted)
If you have explicit permission to remove Hablu branding:
1. Remove "Hablu" from all UI text
2. Replace `public/logo.png` with your logo
3. Update `metadata.title` in `app/layout.tsx`
4. Update landing page description in `app/page.tsx`

## License

Support Library is licensed under the **MIT License**. See `LICENSE` file.

The MIT License permits:
- ✅ Commercial use
- ✅ Modification
- ✅ Distribution
- ✅ Private use
- ✅ Sublicensing

With conditions:
- 📋 Include copyright notice and license in all copies
- 📋 Include attribution to Hablu Programmer (as outlined above)

## Trademarks

- **Hablu Programmer** and **Hablu Support Library** are trademarks of Hablu Programmer
- You may not use these trademarks to endorse or promote your fork without written permission
- The logo in `public/logo.png` is copyrighted by Hablu Programmer

## Contact

For branding questions or permission requests:
- **Email**: eshan@hablu-programmer.com
- **Website**: https://hablu-programmer.com

---

*Thank you for respecting our brand guidelines!*