// Test tabs for verifying parser fixes

// Test 1: E and B string ambiguity
export const ambiguousStringTest = `
e|---0---1---3---0---|
B|---1---1---0---1---|
G|---0---2---0---0---|
D|---2---3---0---2---|
A|---3---3---2---3---|
E|-------1---3-------|
`;

// Test 2: 7-string with low B
export const sevenStringTest = `
e|---0---1---3---0---|
B|---1---1---0---1---|
G|---0---2---0---0---|
D|---2---3---0---2---|
A|---3---3---2---3---|
E|-------1---3-------|
B|---0-------2---0---|
`;

// Test 3: Muted notes and open strings
export const mutedNotesTest = `
e|---x---1---3---o---|
B|---1---x---0---1---|
G|---0---2---x---0---|
D|---2---3---0---2---|
A|---x---3---2---x---|
E|-------x---3---o---|
`;

// Test 4: Extended techniques
export const techniquesTest = `
e|---0h1p0---3b5r3---0~/3\\0---|
B|---1-------0-------1---------|
G|---0-------0-------0---------|
D|---2-------0-------2---------|
A|---3-------2-------3---------|
E|-----------3-----------------|
    PM----PM----PM
`;

// Test 5: Ghost notes and harmonics
export const advancedTechniquesTest = `
e|---(5)---<12>---15t---|
B|---6-----<7>----16t---|
G|---(5)---<5>----15----|
D|---7-----<7>----17----|
A|---7-----<5>----17----|
E|---5------------------|
`;

// Test 6: Invalid fret numbers (should be filtered)
export const invalidFretsTest = `
e|---0---99---3---0---|
B|---1---1----0---1---|
G|---0---2----0---0---|
D|---2---3----0---2---|
A|---3---3----2---3---|
E|-------1----3-------|
`;
