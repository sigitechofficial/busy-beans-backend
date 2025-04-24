<?php
$workingDir = '/home/trimworldwide/stagebb.trimworldwide.com';
$nodeBinPath = '/home/trimworldwide/.nvm/versions/node/v18.20.4/bin';

// Set PATH and HOME for PHP shell_exec environment
putenv("PATH=$nodeBinPath:" . getenv('PATH'));
putenv("HOME=/home/trimworldwide");

$processName = 'thebb.js';

$pm2StopDeleteCommand = "pm2 stop $processName || true && pm2 delete $processName || true";
$pm2CreateCommand = "npm install && pm2 start $processName";
$pm2SaveCommand = "pm2 save";

// Combine everything into a single shell command
$command = "
  cd $workingDir &&
  export PATH=$nodeBinPath:\$PATH &&
  export HOME=/home/trimworldwide &&
  $pm2StopDeleteCommand &&
  $pm2CreateCommand &&
  $pm2SaveCommand
";

// Execute the command
$output = shell_exec($command);

// Show debug output
echo "<pre>";
echo "=== ENV PATH ===\n" . shell_exec("echo \$PATH");
echo "=== which node ===\n" . shell_exec("which node");
echo "=== which npm ===\n" . shell_exec("which npm");
echo "=== which pm2 ===\n" . shell_exec("which pm2");
echo "\n=== SCRIPT OUTPUT ===\n";
echo htmlspecialchars($output);
echo "</pre>";
?>
