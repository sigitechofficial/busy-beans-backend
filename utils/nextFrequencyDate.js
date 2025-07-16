exports.nextFrequencyDate = ({ currentDate, frequency }) => {
  const date = new Date(currentDate); // Ensure we work with a Date object

  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'every-two-weeks':
      date.setDate(date.getDate() + 14);
      break;
    case 'every-four-weeks':
      // Save original day
      const originalDay = date.getDate();
      // Move to next month
      date.setMonth(date.getMonth() + 1);

      // If resulting month doesn't have the same day, adjust (e.g., Feb 30 doesn't exist)
      const daysInMonth = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
      ).getDate();
      if (originalDay > daysInMonth) {
        date.setDate(daysInMonth);
      } else {
        date.setDate(originalDay);
      }
      break;
    default:
      throw new Error('Invalid frequency');
  }

  // Calculate visibility date (3 days before next frequency date)
  const visibilityDate = new Date(date);
  visibilityDate.setDate(visibilityDate.getDate() - 3);

  return {
    nextOrderDate: date,
    visibilityDate: visibilityDate,
  };
};
