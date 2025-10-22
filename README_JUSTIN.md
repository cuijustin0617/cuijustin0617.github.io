# Justin Cui's Research Website

This is a customized al-folio academic website focused on research, publications, and preprints.

## What's Included

- **About Page**: Research description, current work, and contact information
- **Publications**: Automatically generated from `_bibliography/papers.bib`
- **Profile Photo**: Circular profile picture
- **Social Links**: GitHub, LinkedIn, Google Scholar, and email

## What's Removed

- News section
- Blog
- Projects section
- CV/Resume page
- Teaching page
- Repositories page

## Key Files

- `_config.yml`: Site configuration with your personal information
- `_pages/about.md`: Main landing page with research description
- `_bibliography/papers.bib`: Your publications (3 papers included)
- `assets/img/prof_pic.jpg`: Your profile photo
- `_data/socials.yml`: Social media links

## Building Locally

### Prerequisites

Install Ruby and Jekyll:

```bash
# Install Ruby (if not already installed)
# On macOS:
brew install ruby

# Install Jekyll and bundler
gem install jekyll bundler
```

### Build and Serve

```bash
cd al-folio

# Install dependencies
bundle install

# Serve locally (with live reload)
bundle exec jekyll serve

# Visit http://localhost:4000 in your browser
```

## Deploying to GitHub Pages

### Option 1: GitHub Actions (Recommended)

1. Push the `al-folio` folder to a GitHub repository
2. Go to Settings > Pages
3. Set Source to "GitHub Actions"
4. The site will automatically build and deploy on every push

### Option 2: Manual Build

```bash
# Build the site
bundle exec jekyll build

# The output will be in the _site folder
# You can deploy this to any static hosting service
```

## Customization

### Adding Publications

Edit `_bibliography/papers.bib` and add your publications in BibTeX format. Use these fields:

- `abbr`: Venue abbreviation (appears as a badge)
- `preview`: Thumbnail image (place in `assets/img/`)
- `selected={true}`: Show on the main page
- `html`: Link to the paper
- `abstract`: Paper abstract

### Updating Profile Photo

Replace `assets/img/prof_pic.jpg` with your photo.

### Modifying Research Description

Edit `_pages/about.md` to update your research interests and bio.

### Changing Social Links

Edit `_data/socials.yml` to add/remove social media links.

## Configuration Details

The site is configured with:

- Base URL: `https://cuijustin0617.github.io`
- No baseurl (deployed at root)
- Dark mode enabled
- Publication thumbnails enabled
- All authors shown (no limit)
- News and blog posts disabled

## Troubleshooting

### Ruby Version Issues

If you encounter Ruby version issues, use rbenv or rvm:

```bash
# Install rbenv
brew install rbenv

# Install Ruby 3.1.0 or later
rbenv install 3.1.0
rbenv local 3.1.0
```

### Dependency Issues

```bash
# Clear cache and reinstall
rm -rf .bundle vendor Gemfile.lock
bundle install
```

## Support

For al-folio template issues, see:
- [al-folio documentation](https://github.com/alshedivat/al-folio)
- [Jekyll documentation](https://jekyllrb.com/docs/)

For questions about this customization, contact justin.cui@mail.utoronto.ca

