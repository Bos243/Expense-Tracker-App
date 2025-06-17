import { useState, useEffect } from 'react'
import './App.css'
import { Trash } from "lucide-react"
import { db, auth } from './firebase'
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where
} from "firebase/firestore"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth"

type Expense = {
  id: string
  amount: number
  description: string
  category: string
  date: string
  userId: string
}

const categories = [
  "Food", "Transportation", "Entertainment", "Utilities", "Shopping", "Healthcare", "Other"
]

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState('')

  // Listen for auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser)
    return () => unsub()
  }, [])

  // Fetch expenses for the logged-in user
  useEffect(() => {
    if (!user) {
      setExpenses([])
      return
    }
    const q = query(
      collection(db, "expenses"),
      where("userId", "==", user.uid),
      orderBy("date", "desc")
    )
    const unsub = onSnapshot(q, (snapshot) => {
      setExpenses(
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Expense[]
      )
    })
    return () => unsub()
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !description || !category || !date || !user) return
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount < 0) return
    await addDoc(collection(db, "expenses"), {
      amount: parsedAmount,
      description,
      category,
      date,
      userId: user.uid
    })
    setAmount('')
    setDescription('')
    setCategory('')
    setDate(new Date().toISOString().split('T')[0])
  }

  const deleteExpense = async (id: string) => {
    await deleteDoc(doc(db, "expenses", id))
  }

  // Auth handlers
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createUserWithEmailAndPassword(auth, email, password)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
  }

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const categorySummary = categories.map(cat => {
    const total = expenses
      .filter(expense => expense.category === cat)
      .reduce((sum, expense) => sum + expense.amount, 0)
    return { category: cat, total }
  }).filter(item => item.total > 0)

  if (!user) {
    return (
      <div className="app-container">
        <div className="card">
          <h2 className="card-title">{authMode === 'signin' ? 'Sign In' : 'Sign Up'}</h2>
          <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp}>
            <div className="form-group">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <div style={{color: 'red', marginBottom: 8}}>{error}</div>}
            <button className="button" type="submit">{authMode === 'signin' ? 'Sign In' : 'Sign Up'}</button>
          </form>
          <div style={{marginTop: 12}}>
            {authMode === 'signin' ? (
              <span>Don't have an account? <button className="button" style={{padding: 4, fontSize: 14}} onClick={() => setAuthMode('signup')}>Sign Up</button></span>
            ) : (
              <span>Already have an account? <button className="button" style={{padding: 4, fontSize: 14}} onClick={() => setAuthMode('signin')}>Sign In</button></span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="card">
        <h2 className="card-title">Expense Tracker</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="amount">Amount</label>
              <input
                className="input"
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                className="select"
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <input
                className="input"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was this expense for?"
              />
            </div>
            <div className="form-group">
              <label htmlFor="date">Date</label>
              <input
                className="input"
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="button">
            Add Expense
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="card-title">Expense Summary</h2>
        <div className="summary-row">
          <span className="summary-label">Total Expenses:</span>
          <span className="summary-value">${totalExpenses.toFixed(2)}</span>
        </div>
        {categorySummary.length > 0 && (
          <div style={{marginTop: 12}}>
            <h3 style={{fontSize: '1.1rem', color: '#1e293b', marginBottom: 8}}>By Category:</h3>
            {categorySummary.map((item) => (
              <div className="summary-row" key={item.category}>
                <span className="summary-label">{item.category}</span>
                <span className="summary-value">${item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Recent Expenses</h2>
        <div className="expense-list">
          {expenses.length === 0 ? (
            <p style={{color: '#64748b'}}>No expenses recorded yet</p>
          ) : (
            expenses.slice().reverse().map((expense) => (
              <div key={expense.id} className="expense-row">
                <div>
                  <div className="expense-label">{expense.description}</div>
                  <div style={{fontSize: '0.95rem', color: '#64748b'}}>
                    {expense.category} • {expense.date}
                  </div>
                </div>
                <div style={{display: 'flex', alignItems: 'center'}}>
                  <span className="expense-value">${expense.amount.toFixed(2)}</span>
                  <button
                    className="delete-btn"
                    title="Delete"
                    onClick={() => deleteExpense(expense.id)}
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <button className="button" onClick={handleSignOut} style={{marginTop: 16}}>
        Sign Out
      </button>
    </div>
  )
}
