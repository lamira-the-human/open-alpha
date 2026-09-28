export const fractionPractice = [
  {
    id: 'meaning',
    title: 'Name the amount',
    teaching: 'A fraction names equal parts of a whole. The bottom number counts all the equal parts. The top number counts the selected parts.',
    example: 'If 2 of 5 equal parts are selected, the fraction is 2/5.',
    prompt: 'A trail has 8 equal sections. You walk 3 sections. What fraction of the whole trail did you walk?',
    input: 'fraction',
    bars: [{ numerator: 2, denominator: 5 }],
  },
  {
    id: 'equivalence',
    title: 'New pieces, same amount',
    teaching: 'Splitting every piece into smaller equal pieces does not change the amount. Multiply the top and bottom by the same number.',
    example: 'Split every half in two: 1/2 becomes 2/4. Both bars show the same amount of the same-size whole.',
    prompt: 'You have 2/3 of a ribbon. If the whole ribbon is cut into 12 equal pieces, how many pieces do you have? Enter the missing numerator: 2/3 = ?/12.',
    input: 'number',
    bars: [{ numerator: 1, denominator: 2 }, { numerator: 2, denominator: 4 }],
  },
  {
    id: 'comparison',
    title: 'Which amount is larger?',
    teaching: 'Compare amounts of the same-size whole. Make the bottom numbers match so the pieces are the same size. Then compare the top numbers.',
    example: '2/3 = 4/6. Four sixths is more than three sixths, so 2/3 > 3/6. A bigger bottom number does not mean a bigger amount.',
    prompt: 'Two bottles hold the same amount when full. The first is 3/4 full; the second is 5/8 full. Compare the first amount with the second: 3/4 ? 5/8.',
    input: 'comparison',
    bars: [{ numerator: 2, denominator: 3 }, { numerator: 4, denominator: 6 }, { numerator: 3, denominator: 6 }],
  },
] as const;

export function checkFractionAnswer(questionId: string, rawAnswer: unknown) {
  if (typeof rawAnswer !== 'string' || rawAnswer.length > 30) {
    throw new Error('Enter a short answer.');
  }
  const answer = rawAnswer.trim();
  if (questionId === 'meaning') {
    const parts = /^(\d{1,3})\s*\/\s*(\d{1,3})$/.exec(answer);
    if (!parts || Number(parts[2]) === 0) throw new Error('Use a fraction such as 2/5, with a nonzero denominator.');
    const numerator = Number(parts[1]);
    const denominator = Number(parts[2]);
    const correct = numerator * 8 === 3 * denominator;
    return {
      correct,
      explanation: correct
        ? 'Yes. You walked 3 of the 8 equal sections: 3/8 of the trail. Equivalent fractions describe the same amount too.'
        : numerator === 8 && denominator === 3
          ? 'The numbers are reversed. All 8 equal sections belong on the bottom; the 3 sections you walked belong on top. Try 3/8.'
          : 'Count the whole trail, not just the sections left. There are 8 equal sections in total and 3 walked: 3/8. Try again.',
    };
  }
  if (questionId === 'equivalence') {
    if (!/^\d{1,3}$/.test(answer)) throw new Error('Enter only the missing top number, such as 4.');
    const correct = Number(answer) * 3 === 2 * 12;
    return {
      correct,
      explanation: correct
        ? 'Exactly. 3 × 4 = 12, so 2 × 4 = 8. You have 8 of the 12 pieces: 2/3 = 8/12.'
        : Number(answer) === 2
          ? 'You changed only the bottom. Each original piece split into 4 pieces, so your 2 pieces become 2 × 4 = 8. Try 8.'
          : 'Use multiplication, not addition: 3 × 4 = 12. Apply the same change to the top: 2 × 4 = 8. Try 8.',
    };
  }
  if (questionId === 'comparison') {
    if (!['<', '=', '>'].includes(answer)) throw new Error('Choose <, =, or >.');
    return {
      correct: answer === '>',
      explanation: answer === '>'
        ? 'Yes. 3/4 = 6/8. Six eighths is more than five eighths, so 3/4 > 5/8.'
        : 'Compare equal-sized pieces, not the original top numbers. 3/4 = 6/8. Since 6 > 5, the first bottle holds more: choose >.',
    };
  }
  throw new Error('Unknown question.');
}
