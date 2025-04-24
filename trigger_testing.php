<?php
$workingDir = '/home/trimworldwide/stagebb.trimworldwide.com';
$nodeBinDir = '/home/trimworldwide/.nvm/versions/node/v18.20.4/bin';

// Extend PATH for this session
putenv("PATH=$nodeBinDir:" . getenv('PATH'));
putenv("HOME=/home/trimworldwide");

$processName = 'thebb.js';

// Debug path visibility
$debugPath = shell_exec("echo \$PATH");
$whichNode = shell_exec("which node");
$whichNpm = shell_exec("which npm");
$whichPm2 = shell_exec("which pm2");

$command = "
  cd $workingDir &&
  pm2 stop $processName || true &&
  pm2 delete $processName || true &&
  npm install &&
  pm2 start $processName &&
  pm2 save
";

$output = shell_exec($command);

echo "<pre>";
echo "== DEBUG ==\n";
echo "PATH: $debugPath";
echo "which node: $whichNode";
echo "which npm: $whichNpm";
echo "which pm2: $whichPm2\n\n";
echo "== COMMAND OUTPUT ==\n";
echo htmlspecialchars($output);
echo "</pre>";
?>
