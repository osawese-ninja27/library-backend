// The two borrowing rules in one place, so changing a rule means changing one number.

module.exports = {
  // A request holds a copy for this long. If the person has not come to collect the book
  // by then, the request stops counting and the copy is free for someone else.
  HOLD_HOURS: 24,

  // How long a borrowed book can be kept. The clock starts when the librarian approves
  // (which happens when the person physically collects the book).
  LOAN_DAYS: 30,
};
