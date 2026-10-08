@echo off
rem 3D Maintenance Coach: one-command setup and launch on Windows.
rem   1. installs Node.js LTS with winget if it is missing
rem   2. installs dependencies (and copies the browser libraries into web\vendor)
rem   3. creates .env from .env.example on first run (every key is optional)
rem   4. runs the tests in mock mode, starts the local server and opens the page
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Installing Node.js LTS with winget...
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo Could not install Node.js. Install it from https://nodejs.org/ and run this again.
    exit /b 1
  )
  rem winget updates PATH for new shells only; pick up the default install location now.
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

echo Installing dependencies...
call npm install --no-fund --no-audit
if errorlevel 1 exit /b 1

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo Created .env. Add API keys there to enable Claude, OpenAI voice or a local model. Mock mode needs none.
)

echo Running the tests in mock mode...
call npm test
if errorlevel 1 (
  echo Tests failed. See the output above.
  exit /b 1
)

set "PORT=8080"
for /f "tokens=1,* delims==" %%a in ('findstr /b "PORT=" .env 2^>nul') do set "PORT=%%b"
echo Starting the coach on http://localhost:%PORT%/
start "" "http://localhost:%PORT%/"
call npm start
