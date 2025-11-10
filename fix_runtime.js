const fs = require('fs');

// Known list of files that import auth (from the previous command output)
const authFiles = [
  'src/app/api/waitlist/route.ts',
  'src/app/api/test-stripe/route.ts',
  'src/app/api/images/selfie/[sequence]/route.ts',
  'src/app/api/images/generation/[sequence]/route.ts',
  'src/app/api/images/toggle-public/route.ts',
  'src/app/api/admin/search-users/route.ts',
  'src/app/api/admin/change-role/route.ts',
  'src/app/api/admin/free-package-style/route.ts',
  'src/app/api/admin/free-package-style/save/route.ts',
  'src/app/api/admin/impersonate/route.ts',
  'src/app/api/uploads/proxy/route.ts',
  'src/app/api/uploads/delete/route.ts',
  'src/app/api/uploads/[key]/route.ts',
  'src/app/api/uploads/list/route.ts',
  'src/app/api/uploads/create/route.ts',
  'src/app/api/user/settings/route.ts',
  'src/app/api/user/refresh-session/route.ts',
  'src/app/api/user/subscription/route.ts',
  'src/app/api/dashboard/activity/route.ts',
  'src/app/api/dashboard/pending-invites/route.ts',
  'src/app/api/dashboard/route.ts',
  'src/app/api/dashboard/stats/route.ts',
  'src/app/api/styles/personal/route.ts',
  'src/app/api/styles/get/route.ts',
  'src/app/api/styles/team/route.ts',
  'src/app/api/styles/route.ts',
  'src/app/api/styles/[id]/route.ts',
  'src/app/api/styles/[id]/activate/route.ts',
  'src/app/api/styles/save/route.ts',
  'src/app/api/selfies/selected/route.ts',
  'src/app/api/selfies/[id]/select/route.ts',
  'src/app/api/team/route.ts',
  'src/app/api/team/members/role/route.ts',
  'src/app/api/packages/owned/route.ts',
  'src/app/api/packages/grant/route.ts',
  'src/app/api/files/get/route.ts',
  'src/app/api/files/download/route.ts',
  'src/app/api/generations/list/route.ts',
  'src/app/api/generations/[id]/route.ts',
  'src/app/api/generations/create/route.ts',
  'src/app/api/account/mode/route.ts',
  'src/app/api/credits/balance/route.ts',
  'src/app/api/upload/route.ts',
  'src/app/api/stripe/checkout/route.ts',
  'src/app/api/stripe/subscriptions/upgrade/route.ts',
  'src/app/api/stripe/subscriptions/downgrade/route.ts',
  'src/app/api/stripe/subscriptions/create/route.ts',
  'src/app/api/stripe/subscription/route.ts',
  'src/app/api/debug/check-file/route.ts'
];

// Filter to only files without nodejs runtime
const needsRuntime = authFiles.filter(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    return !content.includes("export const runtime = 'nodejs'");
  } catch (e) {
    return false;
  }
});

console.log('Files that need runtime = nodejs added:');
needsRuntime.forEach(file => console.log(file));

// Add runtime to each file
needsRuntime.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  // Find the line after imports
  let insertIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import')) {
      continue;
    }
    if (lines[i].trim() === '') {
      continue;
    }
    insertIndex = i;
    break;
  }

  if (insertIndex > 0) {
    lines.splice(insertIndex, 0, '', "export const runtime = 'nodejs'");
    fs.writeFileSync(file, lines.join('\n'));
    console.log(`Added runtime to ${file}`);
  }
});

console.log(`\nDone! Added runtime = 'nodejs' to ${needsRuntime.length} files.`);
