# Script to fix .js imports to .jsx for local components
$files = Get-ChildItem -Path "src" -Recurse -Include "*.js", "*.jsx"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Replace imports with .js for components that are now .jsx
    $content = $content -replace "from '\.\/Icon\.js'", "from './Icon.jsx'"
    $content = $content -replace "from '\.\/Modal\.js'", "from './Modal.jsx'"
    $content = $content -replace "from '\.\/Spinner\.js'", "from './Spinner.jsx'"
    
    # Write back to file
    Set-Content $file.FullName -Value $content
    Write-Host "Fixed: $($file.Name)"
}

Write-Host "All imports fixed!"
