import { validateSprintEntries } from '../src/lib/time-utils';

const testEntries = [
    {
        date: "2026-04-07",
        timeStart: "10:10",
        timeStop: "11:10",
        stream: "CS",
        year: "1st",
        semester: "1st",
        subjectCode: "CS101",
        subjectName: "Intro",
        topics: "Topic 1",
        section: "A"
    },
    {
        date: "2026-04-07",
        timeStart: "10:10",
        timeStop: "11:10",
        stream: "CS",
        year: "1st",
        semester: "1st",
        subjectCode: "CS102",
        subjectName: "Intro 2",
        topics: "Topic 2",
        section: "A"
    }
];

const result = validateSprintEntries(testEntries);
console.log("Validation Result (Overlapping):", result);

const invalidFormat = [
    {
        date: "2026-04-07",
        timeStart: "25:00",
        timeStop: "11:10"
    }
];
console.log("Validation Result (Invalid Format):", validateSprintEntries(invalidFormat as any));

const invalidRange = [
    {
        date: "2026-04-07",
        timeStart: "11:10",
        timeStop: "10:10"
    }
];
console.log("Validation Result (Invalid Range):", validateSprintEntries(invalidRange as any));
