'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Lock, Mail, Shield } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const action = isCreating ? 'create' : 'login'
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email, password, name: email.split('@')[0] })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      // Check if we need to create the first admin
      if (isCreating && data.success) {
        setIsCreating(false)
        // Auto-login after creation
        const loginResponse = await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', email, password })
        })

        if (!loginResponse.ok) {
          throw new Error('Auto-login failed after creation')
        }

        router.push('/admin')
        return
      }

      router.push('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Shield className="text-primary size-8" />
          </div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {isCreating ? 'Create the first admin account' : 'Sign in to manage users and agents'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isCreating ? 'Creating admin...' : 'Signing in...'}
              </>
            ) : isCreating ? (
              'Create Admin Account'
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        {/* Toggle between create/login for first admin */}
        <p className="text-muted-foreground text-center text-sm">
          {isCreating ? (
            <>
              Already have an admin account?{' '}
              <button
                onClick={() => setIsCreating(false)}
                className="text-primary font-medium hover:underline"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              First time setup?{' '}
              <button
                onClick={() => setIsCreating(true)}
                className="text-primary font-medium hover:underline"
              >
                Create admin
              </button>
            </>
          )}
        </p>

        {/* Back to site link */}
        <p className="text-center text-sm">
          <Link href="/" className="text-muted-foreground font-medium hover:underline">
            ← Back to site
          </Link>
        </p>
      </div>
    </div>
  )
}
