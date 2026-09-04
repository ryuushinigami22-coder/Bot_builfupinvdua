// Application bootstrap
const { startupBackup } = require("../flutter");

require('./core/runtime');
require('./features/helpers');
require('./features/cards');
require('./features/system');
require('./features/virusscanner');
require('./features/build');
require('./features/project');
require('./features/assets');
require('./features/tools');
require('./features/ai');
require('./features/enc');
require('./features/dartpreview');
require('./features/tqto');
require('./features/html_to_dart.js');
require('./features/owner');
require('./features/functionchanger');
require('./features/aifixer');
require('./features/airombak');
require('./features/reaction');
require('./features/ai_tools_extra');
require('./features/ai_visual_copy');
require('./features/main');

(async () => {
  try {
    await startupBackup();
  } catch (err) {
    console.error('[BACKUP] Startup backup gagal:', err.message);
  }
  return main();
})().catch((err) => {
  console.error('Fatal bot error:', err);
  process.exitCode = 1;
});
