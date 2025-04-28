<?php
// Path to working directory
$workingDir = '/home/trimworldwide/backendbb.trimworldwide.com';

// Node binary path
$nodeBinPath = '/home/trimworldwide/.nvm/versions/node/v18.20.4/bin';

// Command to execute
$processName = 'bb.js';

// Building the full shell command
$command = "export PATH=$nodeBinPath:\$PATH && export HOME=/home/trimworldwide && cd $workingDir && pm2 stop $processName || true && pm2 delete $processName || true && npm install && pm2 start $processName && pm2 save";

// Run the command in the background
shell_exec("$command > /dev/null 2>&1 &");

// Immediate response to client (curl)
echo "<pre>";
echo "Deployment triggered successfully. NPM install and PM2 restart are running in the background.";
echo "</pre>";
?>
