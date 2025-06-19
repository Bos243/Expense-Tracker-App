import { useEffect, useState } from 'react'
import './App.css'
import { Trash } from "lucide-react"
import { db, auth } from './firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  User
} from "firebase/auth"
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  Timestamp
} from "firebase/firestore"

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

const sortOptions = [
  { label: "Newest First", value: "newest" },
  { label: "Oldest First", value: "oldest" },
  { label: "Lowest Amount", value: "low" },
  { label: "Highest Amount", value: "high" }
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
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user || !user.emailVerified) {
      setExpenses([])
      return
    }

    const q = query(
      collection(db, "expenses"),
      where("userId", "==", user.uid)
    )

    const unsub = onSnapshot(q, async (snapshot) => {
      const fetched = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          amount: data.amount,
          description: data.description,
          category: data.category,
          userId: data.userId,
          date: data.date?.toDate().toISOString().split('T')[0] || ''
        }
      })
      setExpenses(fetched)

      // Fetch monthly budget
      const monthKey = new Date().toISOString().slice(0, 7)
      const budgetRef = doc(db, "budgets", `${user.uid}_${monthKey}`)
      const budgetSnap = await getDoc(budgetRef)
      if (budgetSnap.exists()) {
        setMonthlyBudget(budgetSnap.data().amount)
      } else {
        setMonthlyBudget(null)
      }
    }, (err) => {
      console.error("Snapshot error:", err.message)
    })

    return () => unsub()
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !description || !category || !date || !user) return
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount < 0) return

    const newDate = new Date(date)
    const currentMonthKey = newDate.toISOString().slice(0, 7)

    const currentMonthExpenses = expenses
      .filter(exp => exp.date.startsWith(currentMonthKey))
      .reduce((sum, exp) => sum + exp.amount, 0)

    const willExceedBudget = monthlyBudget !== null && (currentMonthExpenses + parsedAmount) > monthlyBudget

    try {
      setIsSubmitting(true)
      await addDoc(collection(db, "expenses"), {
        amount: parsedAmount,
        description,
        category,
        date: Timestamp.fromDate(newDate),
        userId: user.uid
      })

      if (willExceedBudget) {
        alert("⚠️ You've exceeded your monthly budget!")
      }

      setAmount('')
      setDescription('')
      setCategory('')
      setDate(new Date().toISOString().split('T')[0])
    } catch (err) {
      console.error("Error adding document:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteExpense = async (id: string) => {
    await deleteDoc(doc(db, "expenses", id))
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password)
      if (userCred.user && !userCred.user.emailVerified) {
        await sendEmailVerification(userCred.user)
        alert("✅ Verification email sent! Please check your inbox.")
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password)
      if (!userCred.user.emailVerified) {
        await signOut(auth)
        setError("⚠️ Email not verified. Please check your inbox.")
        return
      }
      setUser(userCred.user)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
  }

  const handlePasswordReset = async () => {
    if (!email) return alert("Enter your email to reset password.")
    try {
      await sendPasswordResetEmail(auth, email)
      alert("📧 Password reset email sent.")
    } catch (err: any) {
      alert("Error: " + err.message)
    }
  }

  const handleBudgetSave = async () => {
    if (!user) return
    const amount = prompt("Enter your monthly budget in ETB:")
    if (!amount || isNaN(+amount)) return alert("Invalid amount.")

    const monthKey = new Date().toISOString().slice(0, 7)
    const ref = doc(db, "budgets", `${user.uid}_${monthKey}`)
    await setDoc(ref, { amount: parseFloat(amount) })
    alert("✅ Budget saved.")
  }

  const handleBudgetDelete = async () => {
    if (!user) return
    const monthKey = new Date().toISOString().slice(0, 7)
    const ref = doc(db, "budgets", `${user.uid}_${monthKey}`)
    await setDoc(ref, {}) // empty doc
    setMonthlyBudget(null)
    alert("❌ Budget deleted.")
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  const filtered = filterCategory
    ? expenses.filter(e => e.category === filterCategory)
    : expenses

  const sorted = [...filtered].sort((a, b) => {
    switch (sortOrder) {
      case 'newest': return b.date.localeCompare(a.date)
      case 'oldest': return a.date.localeCompare(b.date)
      case 'low': return a.amount - b.amount
      case 'high': return b.amount - a.amount
      default: return 0
    }
  })

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
            {error && <div style={{ color: 'red' }}>{error}</div>}
            {loading ? <Spinner /> : (
              <button className="button" type="submit">
                {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            )}
          </form>
          <button onClick={handlePasswordReset} className="button" style={{ marginTop: 8 }}>
            Forgot Password?
          </button>
          <div style={{ marginTop: 10 }}>
            {authMode === 'signin'
              ? <span>Don't have an account? <button className="button" onClick={() => setAuthMode('signup')}>Sign Up</button></span>
              : <span>Already have an account? <button className="button" onClick={() => setAuthMode('signin')}>Sign In</button></span>}
          </div>
        </div>
      </div>
    )
  }

  if (user && !user.emailVerified) {
    return (
      <div className="app-container">
        <div className="card">
          <h2>Please Verify Your Email</h2>
          <p>Check your inbox at <strong>{user.email}</strong> for the verification link.</p>
          <button className="button" onClick={handleSignOut}>Sign Out</button>
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
            <input className="input" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
            <input className="input" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="form-row">
            <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Select Category</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <button className="button" type="submit">Add Expense</button>
          {isSubmitting && <Spinner />}
        </form>
      </div>

      <div className="card">
        <h2>Total: ETB {totalExpenses.toFixed(2)}</h2>
        {monthlyBudget && (
          <p>Monthly Budget: <strong>ETB {monthlyBudget}</strong></p>
        )}
        <button className="button" onClick={handleBudgetSave}>Set/Update Budget</button>
        <button className="button" onClick={handleBudgetDelete}>Delete Budget</button>
      </div>

      <div className="card">
        <h3>Filter & Sort</h3>
        <select className="select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select" value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
          {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      <div className="card">
        <h2>Recent Expenses</h2>
        {sorted.map(expense => (
          <div key={expense.id} className="expense-row">
            <div>
              <strong>{expense.description}</strong> <br />
              <small>{expense.category} | {expense.date}</small>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: 10 }}>ETB {expense.amount.toFixed(2)}</span>
              <button onClick={() => deleteExpense(expense.id)}><Trash size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleSignOut} className="button" style={{ marginTop: 16 }}>
        Sign Out
      </button>
    </div>
  )
}

// Spinner Component Inline (can move to separate file if needed)
function Spinner() {
  return (
    <div style={{ textAlign: 'center', marginTop: 16 }}>
      <div className="spinner" />
      <style>{`
        .spinner {
          width: 24px;
          height: 24px;
          border: 4px solid #ccc;
          border-top: 4px solid #0ea5e9;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
