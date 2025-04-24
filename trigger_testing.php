<?php
$workingDir = '/home/trimworldwide/stagebb.trimworldwide.com';
$nodeBinDir = '/home/trimworldwide/.nvm/versions/node/v18.20.4/bin'; // <-- FIXED

// Set the PATH correctly
putenv("PATH=$nodeBinDir:" . getenv('PATH'));
putenv("HOME=/home/trimworldwide");

$processName = 'thebb.js';

$pm2StopDeleteCommand = "pm2 stop $processName || true && pm2 delete $processName || true";
$pm2CreateCommand = "npm install && pm2 start $processName";
$pm2SaveCommand = "pm2 save";

// Combine everything
$command = "cd $workingDir && $pm2StopDeleteCommand && $pm2CreateCommand && $pm2SaveCommand 2>&1";

// Execute and show output
$output = shell_exec($command);
echo "<pre>Command Output:\n" . htmlspecialchars($output) . "</pre>";
?>
