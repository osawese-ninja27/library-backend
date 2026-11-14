// scripts/booksList.js
// The list of 100 books to seed. Each entry: [title, author, category, genre]
// Category = the admin-managed category (created automatically if missing).
// Genre    = free-text field on the book (matches your books.genre column).

const books = [
  // ---- Programming & Technology (14) ----
  ['Clean Code', 'Robert C. Martin', 'Programming & Technology', 'Software Engineering'],
  ['The Pragmatic Programmer', 'Andrew Hunt', 'Programming & Technology', 'Software Engineering'],
  ['Eloquent JavaScript', 'Marijn Haverbeke', 'Programming & Technology', 'JavaScript'],
  ['Introduction to Algorithms', 'Thomas H. Cormen', 'Programming & Technology', 'Algorithms'],
  ['Design Patterns', 'Erich Gamma', 'Programming & Technology', 'Software Design'],
  ['Code Complete', 'Steve McConnell', 'Programming & Technology', 'Software Engineering'],
  ['Refactoring', 'Martin Fowler', 'Programming & Technology', 'Software Engineering'],
  ['The Mythical Man-Month', 'Frederick P. Brooks', 'Programming & Technology', 'Project Management'],
  ['Designing Data-Intensive Applications', 'Martin Kleppmann', 'Programming & Technology', 'System Design'],
  ['Python Crash Course', 'Eric Matthes', 'Programming & Technology', 'Python'],
  ['Automate the Boring Stuff with Python', 'Al Sweigart', 'Programming & Technology', 'Python'],
  ['Cracking the Coding Interview', 'Gayle Laakmann McDowell', 'Programming & Technology', 'Career'],
  ['The Phoenix Project', 'Gene Kim', 'Programming & Technology', 'DevOps'],
  ["Don't Make Me Think", 'Steve Krug', 'Programming & Technology', 'UI/UX Design'],

  // ---- African Literature (11) ----
  ['Things Fall Apart', 'Chinua Achebe', 'African Literature', 'Historical Fiction'],
  ['Arrow of God', 'Chinua Achebe', 'African Literature', 'Historical Fiction'],
  ['Half of a Yellow Sun', 'Chimamanda Ngozi Adichie', 'African Literature', 'Historical Fiction'],
  ['Purple Hibiscus', 'Chimamanda Ngozi Adichie', 'African Literature', 'Coming of Age'],
  ['Americanah', 'Chimamanda Ngozi Adichie', 'African Literature', 'Contemporary Fiction'],
  ['The Joys of Motherhood', 'Buchi Emecheta', 'African Literature', 'Literary Fiction'],
  ['Weep Not, Child', "Ngugi wa Thiong'o", 'African Literature', 'Historical Fiction'],
  ['So Long a Letter', 'Mariama Ba', 'African Literature', 'Epistolary Fiction'],
  ['The Famished Road', 'Ben Okri', 'African Literature', 'Magical Realism'],
  ['Stay With Me', 'Ayobami Adebayo', 'African Literature', 'Contemporary Fiction'],
  ['Season of Crimson Blossoms', 'Abubakar Adam Ibrahim', 'African Literature', 'Contemporary Fiction'],

  // ---- Classics (13) ----
  ['Pride and Prejudice', 'Jane Austen', 'Classics', 'Romance'],
  ['1984', 'George Orwell', 'Classics', 'Dystopian'],
  ['Animal Farm', 'George Orwell', 'Classics', 'Political Satire'],
  ['To Kill a Mockingbird', 'Harper Lee', 'Classics', 'Southern Gothic'],
  ['The Great Gatsby', 'F. Scott Fitzgerald', 'Classics', 'Tragedy'],
  ['Jane Eyre', 'Charlotte Bronte', 'Classics', 'Gothic Romance'],
  ['Wuthering Heights', 'Emily Bronte', 'Classics', 'Gothic Romance'],
  ['Great Expectations', 'Charles Dickens', 'Classics', 'Coming of Age'],
  ['Frankenstein', 'Mary Shelley', 'Classics', 'Gothic Horror'],
  ['Crime and Punishment', 'Fyodor Dostoevsky', 'Classics', 'Psychological Fiction'],
  ['The Catcher in the Rye', 'J.D. Salinger', 'Classics', 'Coming of Age'],
  ['Brave New World', 'Aldous Huxley', 'Classics', 'Dystopian'],
  ['Lord of the Flies', 'William Golding', 'Classics', 'Allegory'],

  // ---- Science Fiction & Fantasy (13) ----
  ['Dune', 'Frank Herbert', 'Science Fiction & Fantasy', 'Science Fiction'],
  ['The Hobbit', 'J.R.R. Tolkien', 'Science Fiction & Fantasy', 'Fantasy'],
  ['The Fellowship of the Ring', 'J.R.R. Tolkien', 'Science Fiction & Fantasy', 'Fantasy'],
  ["Harry Potter and the Sorcerer's Stone", 'J.K. Rowling', 'Science Fiction & Fantasy', 'Fantasy'],
  ["Ender's Game", 'Orson Scott Card', 'Science Fiction & Fantasy', 'Science Fiction'],
  ['Foundation', 'Isaac Asimov', 'Science Fiction & Fantasy', 'Science Fiction'],
  ['Neuromancer', 'William Gibson', 'Science Fiction & Fantasy', 'Cyberpunk'],
  ["The Hitchhiker's Guide to the Galaxy", 'Douglas Adams', 'Science Fiction & Fantasy', 'Comedy Sci-Fi'],
  ['Fahrenheit 451', 'Ray Bradbury', 'Science Fiction & Fantasy', 'Dystopian'],
  ['The Name of the Wind', 'Patrick Rothfuss', 'Science Fiction & Fantasy', 'Fantasy'],
  ['A Game of Thrones', 'George R.R. Martin', 'Science Fiction & Fantasy', 'Fantasy'],
  ['The Martian', 'Andy Weir', 'Science Fiction & Fantasy', 'Science Fiction'],
  ['Binti', 'Nnedi Okorafor', 'Science Fiction & Fantasy', 'Afrofuturism'],

  // ---- Mystery & Thriller (8) ----
  ['The Da Vinci Code', 'Dan Brown', 'Mystery & Thriller', 'Thriller'],
  ['Angels & Demons', 'Dan Brown', 'Mystery & Thriller', 'Thriller'],
  ['Gone Girl', 'Gillian Flynn', 'Mystery & Thriller', 'Psychological Thriller'],
  ['And Then There Were None', 'Agatha Christie', 'Mystery & Thriller', 'Detective'],
  ['Murder on the Orient Express', 'Agatha Christie', 'Mystery & Thriller', 'Detective'],
  ['The Girl with the Dragon Tattoo', 'Stieg Larsson', 'Mystery & Thriller', 'Crime'],
  ['The Silent Patient', 'Alex Michaelides', 'Mystery & Thriller', 'Psychological Thriller'],
  ['The Hound of the Baskervilles', 'Arthur Conan Doyle', 'Mystery & Thriller', 'Detective'],

  // ---- Self-Help & Business (16) ----
  ['Atomic Habits', 'James Clear', 'Self-Help & Business', 'Personal Development'],
  ['Rich Dad Poor Dad', 'Robert T. Kiyosaki', 'Self-Help & Business', 'Personal Finance'],
  ['The Psychology of Money', 'Morgan Housel', 'Self-Help & Business', 'Personal Finance'],
  ['Think and Grow Rich', 'Napoleon Hill', 'Self-Help & Business', 'Personal Development'],
  ['How to Win Friends and Influence People', 'Dale Carnegie', 'Self-Help & Business', 'Communication'],
  ['The 7 Habits of Highly Effective People', 'Stephen R. Covey', 'Self-Help & Business', 'Personal Development'],
  ['Deep Work', 'Cal Newport', 'Self-Help & Business', 'Productivity'],
  ['The Lean Startup', 'Eric Ries', 'Self-Help & Business', 'Entrepreneurship'],
  ['Zero to One', 'Peter Thiel', 'Self-Help & Business', 'Entrepreneurship'],
  ['The Power of Now', 'Eckhart Tolle', 'Self-Help & Business', 'Mindfulness'],
  ['Mindset', 'Carol S. Dweck', 'Self-Help & Business', 'Psychology'],
  ['Thinking, Fast and Slow', 'Daniel Kahneman', 'Self-Help & Business', 'Psychology'],
  ['The 48 Laws of Power', 'Robert Greene', 'Self-Help & Business', 'Strategy'],
  ['Good to Great', 'Jim Collins', 'Self-Help & Business', 'Business'],
  ['The Intelligent Investor', 'Benjamin Graham', 'Self-Help & Business', 'Investing'],
  ['Start with Why', 'Simon Sinek', 'Self-Help & Business', 'Leadership'],

  // ---- History & Biography (10) ----
  ['Sapiens', 'Yuval Noah Harari', 'History & Biography', 'History'],
  ['Long Walk to Freedom', 'Nelson Mandela', 'History & Biography', 'Autobiography'],
  ['Becoming', 'Michelle Obama', 'History & Biography', 'Memoir'],
  ['The Diary of a Young Girl', 'Anne Frank', 'History & Biography', 'Memoir'],
  ['Steve Jobs', 'Walter Isaacson', 'History & Biography', 'Biography'],
  ['Educated', 'Tara Westover', 'History & Biography', 'Memoir'],
  ['Guns, Germs, and Steel', 'Jared Diamond', 'History & Biography', 'History'],
  ['Born a Crime', 'Trevor Noah', 'History & Biography', 'Memoir'],
  ['Why Nations Fail', 'Daron Acemoglu', 'History & Biography', 'Economics & History'],
  ['The Autobiography of Malcolm X', 'Malcolm X', 'History & Biography', 'Autobiography'],

  // ---- Science (6) ----
  ['A Brief History of Time', 'Stephen Hawking', 'Science', 'Physics'],
  ['Cosmos', 'Carl Sagan', 'Science', 'Astronomy'],
  ['The Selfish Gene', 'Richard Dawkins', 'Science', 'Biology'],
  ['Astrophysics for People in a Hurry', 'Neil deGrasse Tyson', 'Science', 'Astronomy'],
  ['The Gene', 'Siddhartha Mukherjee', 'Science', 'Biology'],
  ["Surely You're Joking, Mr. Feynman!", 'Richard P. Feynman', 'Science', 'Physics'],

  // ---- Literary Fiction (9) ----
  ['The Kite Runner', 'Khaled Hosseini', 'Literary Fiction', 'Drama'],
  ['A Thousand Splendid Suns', 'Khaled Hosseini', 'Literary Fiction', 'Drama'],
  ['Life of Pi', 'Yann Martel', 'Literary Fiction', 'Adventure'],
  ['The Book Thief', 'Markus Zusak', 'Literary Fiction', 'Historical Fiction'],
  ['One Hundred Years of Solitude', 'Gabriel Garcia Marquez', 'Literary Fiction', 'Magical Realism'],
  ['The Old Man and the Sea', 'Ernest Hemingway', 'Literary Fiction', 'Novella'],
  ['The Little Prince', 'Antoine de Saint-Exupery', 'Literary Fiction', 'Fable'],
  ['The Alchemist', 'Paulo Coelho', 'Literary Fiction', 'Fable'],
  ['Where the Crawdads Sing', 'Delia Owens', 'Literary Fiction', 'Mystery Drama'],
];

module.exports = books;
