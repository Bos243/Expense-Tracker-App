import { useState, useEffect } from 'react'
import './App.css'
import { Trash } from "lucide-react"
import { db, auth } from './firebase'
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { getDocs } from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User
} from "firebase/auth"
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  getDoc,
  setDoc,
  deleteDoc as deleteBudgetDoc,
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
  const [loading, setLoading] = useState(false)  // for sign in/up loading
  const [submittingExpense, setSubmittingExpense] = useState(false) // for adding expense
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [budgetDeleting, setBudgetDeleting] = useState(false)
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null)
  const [newBudget, setNewBudget] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        await fetchBudget(currentUser.uid)
      }
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

    const unsub = onSnapshot(q, (snapshot) => {
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
    })

    return () => unsub()
  }, [user])

  const fetchBudget = async (uid: string) => {
    const docRef = doc(db, "budgets", uid)
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      setMonthlyBudget(snap.data().amount)
    } else {
      setMonthlyBudget(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !description || !category || !date || !user) return
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount < 0) return

    setSubmittingExpense(true)
    try {
      await addDoc(collection(db, "expenses"), {
        amount: parsedAmount,
        description,
        category,
        date: Timestamp.fromDate(new Date(date)),
        userId: user.uid
      })

      const updatedTotal = totalExpenses + parsedAmount
      if (monthlyBudget !== null && updatedTotal > monthlyBudget) {
        alert("⚠️ Warning: You have exceeded your monthly budget!")
      }

      setAmount('')
      setDescription('')
      setCategory('')
      setDate(new Date().toISOString().split('T')[0])
    } catch (err) {
      console.error("Error adding document:", err)
    } finally {
      setSubmittingExpense(false)
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
      const user = userCred.user
      if (!user.emailVerified) {
        await signOut(auth)
        setError("⚠️ Email not verified. Please check your inbox.")
        return
      }
      setUser(user)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
  }

  const handleResetPassword = async () => {
    if (!email) return alert("Enter your email first.")
    try {
      await sendPasswordResetEmail(auth, email)
      alert("📩 Password reset email sent.")
    } catch (err: any) {
      alert(err.message)
    }
  }

  const saveBudget = async () => {
    if (!user || !newBudget) return
    const parsed = parseFloat(newBudget)
    if (isNaN(parsed) || parsed < 0) return

    setBudgetSaving(true)
    try {
      await setDoc(doc(db, "budgets", user.uid), { amount: parsed })
      setMonthlyBudget(parsed)
      setNewBudget('')
      alert("✅ Budget saved!")
    } catch (err) {
      console.error("Error saving budget:", err)
    } finally {
      setBudgetSaving(false)
    }
  }

  const deleteBudget = async () => {
    if (!user) return

    setBudgetDeleting(true)
    try {
      await deleteBudgetDoc(doc(db, "budgets", user.uid))
      setMonthlyBudget(null)
      alert("🗑️ Budget deleted.")
    } catch (err) {
      console.error("Error deleting budget:", err)
    } finally {
      setBudgetDeleting(false)
    }
  }

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const categorySummary = categories.map(cat => {
    const total = expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0)
    return { category: cat, total }
  }).filter(item => item.total > 0)

  const filteredExpenses = expenses
    .filter(e => !filterCategory || e.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'date') {
        const aTime = new Date(a.date).getTime()
        const bTime = new Date(b.date).getTime()
        return sortOrder === 'asc' ? aTime - bTime : bTime - aTime
      } else {
        return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount
      }
    })

  // *** New function for exporting filtered expenses as CSV ***
  const exportExpensesCSV = () => {
    if (filteredExpenses.length === 0) {
      alert("No expenses to export.")
      return
    }
    const csvHeader = "Description,Category,Date,Amount\n"
    const csvRows = filteredExpenses.map(e =>
      `"${e.description.replace(/"/g, '""')}",${e.category},${e.date},${e.amount.toFixed(2)}`
    )
    const csvContent = csvHeader + csvRows.join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `expenses_export_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
            {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
            <button className="button" type="submit" disabled={loading}>
              {loading ? (
                <span className="spinner"></span>
              ) : (
                authMode === 'signin' ? 'Sign In' : 'Sign Up'
              )}
            </button>
          </form>
          <button className="button" onClick={handleResetPassword} style={{ marginTop: 8 }}>
            Forgot Password?
          </button>
          <div style={{ marginTop: 12 }}>
            {authMode === 'signin' ? (
              <span>Don't have an account? <button className="button" style={{ padding: 4 }} onClick={() => setAuthMode('signup')}>Sign Up</button></span>
            ) : (
              <span>Already have an account? <button className="button" style={{ padding: 4 }} onClick={() => setAuthMode('signin')}>Sign In</button></span>
            )}
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
          <p>A verification email has been sent to <strong>{user.email}</strong>.</p>
          <button className="button" onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="card">
        <h2>Expense Tracker</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Amount</label>
              <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Description</label>
              <input className="input" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <button className="button" type="submit" disabled={submittingExpense}>
            {submittingExpense ? <span className="spinner"></span> : 'Add Expense'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Monthly Budget</h2>
        <p>Current Budget: <strong>{monthlyBudget !== null ? `ETB${monthlyBudget}` : 'Not Set'}</strong></p>
        <input className="input" type="number" placeholder="Enter new budget" value={newBudget} onChange={e => setNewBudget(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="button" onClick={saveBudget} disabled={budgetSaving}>
            {budgetSaving ? <span className="spinner"></span> : 'Save Budget'}
          </button>
          <button className="button" onClick={deleteBudget} disabled={budgetDeleting}>
            {budgetDeleting ? <span className="spinner"></span> : 'Delete Budget'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Recent Expenses</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <select className="select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select className="select" value={sortBy} onChange={e => setSortBy(e.target.value as 'date' | 'amount')}>
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
          </select>
          <select className="select" value={sortOrder} onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>

          {/* Export Button */}
          <button className="button" onClick={exportExpensesCSV}>
            Export Expenses
          </button>
        </div>
        <div className="expense-list">
          {filteredExpenses.length === 0 ? (
            <p>No expenses recorded yet</p>
          ) : (
            filteredExpenses.map(expense => (
              <div key={expense.id} className="expense-row">
                <div>
                  <div className="expense-label">{expense.description}</div>
                  <div style={{ fontSize: '0.9rem' }}>{expense.category} • {expense.date}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="expense-value">ETB{expense.amount.toFixed(2)}</span>
                  <button className="delete-btn" onClick={() => deleteExpense(expense.id)}><Trash size={18} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <button className="button" onClick={handleSignOut} style={{ marginTop: 16 }}>Sign Out</button>
      {/* Delete Account Button */}
<div style={{ marginTop: 20 }}>
  <button
    onClick={async () => {
      const confirmed = window.confirm("⚠️ Are you sure you want to permanently delete your account and all your data?");
      if (!confirmed) return;

      const password = prompt("Please re-enter your password to confirm account deletion:");
      if (!password || !user?.email) return alert("Password required.");

      try {
        // Re-authenticate the user
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);

        // Delete all expenses
        const expenseQuery = query(collection(db, "expenses"), where("userId", "==", user.uid));
        const expenseSnapshot = await getDocs(expenseQuery);
        const deletePromises = expenseSnapshot.docs.map(docSnap => deleteDoc(doc(db, "expenses", docSnap.id)));

        // Delete budget
        deletePromises.push(deleteDoc(doc(db, "budgets", user.uid)));

        await Promise.all(deletePromises);

        // Delete the user account
        await deleteUser(user);
        alert("✅ Your account and all data have been permanently deleted.");
        window.location.reload();
      } catch (err: any) {
        if (err.code === 'auth/wrong-password') {
          alert("❌ Incorrect password. Please try again.");
        } else if (err.code === 'auth/requires-recent-login') {
          alert("⚠️ Please sign in again before deleting your account.");
        } else {
          alert("Error: " + err.message);
        }
      }
    }}
    style={{
      backgroundColor: '#dc2626',
      color: 'white',
      padding: '10px 16px',
      border: 'none',
      borderRadius: 6,
      fontWeight: 'bold',
      cursor: 'pointer',
      marginTop: 8
    }}
  >
    🗑️ Delete My Account
  </button>
</div>

    </div>
  )
}
