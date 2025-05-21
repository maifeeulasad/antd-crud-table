import express from 'express';
import bodyParser from 'body-parser';
import { Request, Response } from 'express';

interface User {
  id: number;
  name: string;
  age: number;
  createdAt: string;
  status: 'active' | 'inactive';
  isAdmin: boolean;
}

const app = express();
app.use(bodyParser.json());

let users: User[] = [
  { id: 1, name: 'Jane Smith 1', age: 30, createdAt: '2023-01-01', status: 'active', isAdmin: true },
];

// Get all users
app.get('/users', (_req: Request, res: Response) => {
  res.json(users);
});

// Get a user by ID
app.get('/users/:id', (req: Request, res: Response) => {
  const user = users.find(u => u.id === Number(req.params.id));
  if (user) res.json(user);
  else res.status(404).json({ message: 'User not found' });
});

// Create a new user
app.post('/users', (req: Request, res: Response) => {
  const newUser: User = { id: Date.now(), ...req.body };
  users.push(newUser);
  res.status(201).json(newUser);
});

// Update a user
app.put('/users/:id', (req: Request, res: Response) => {
  const index = users.findIndex(u => u.id === Number(req.params.id));
  if (index !== -1) {
    users[index] = { ...users[index], ...req.body };
    res.json(users[index]);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// Delete a user
app.delete('/users/:id', (req: Request, res: Response) => {
  const index = users.findIndex(u => u.id === Number(req.params.id));
  if (index !== -1) {
    const deleted = users.splice(index, 1);
    res.json(deleted[0]);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`CRUD server running at http://localhost:${PORT}`);
});
