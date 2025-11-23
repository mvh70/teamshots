import { generatePosePrompt } from './src/domain/style/prompt-builders/pose.ts';

console.log('Testing expression independence from poses...');

// Test 1: Pose preset with user expression "friendly"
const test1 = generatePosePrompt({
  pose: { type: 'power_crossed' },
  expression: { type: 'friendly' }
});
console.log('Test 1 - Pose: power_crossed, Expression: friendly');
console.log('Expression result:', test1.expression);
console.log();

// Test 2: Same pose with different expression "serious"
const test2 = generatePosePrompt({
  pose: { type: 'power_crossed' },
  expression: { type: 'serious' }
});
console.log('Test 2 - Pose: power_crossed, Expression: serious');
console.log('Expression result:', test2.expression);
console.log();

// Test 3: User choice pose with expression
const test3 = generatePosePrompt({
  pose: { type: 'user-choice' },
  expression: { type: 'confident' }
});
console.log('Test 3 - Pose: user-choice, Expression: confident');
console.log('Expression result:', test3.expression);
console.log();

console.log('If expressions are different between test 1 and 2, independence works! ✅');
