'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Shield } from 'lucide-react'

export default function RegisterPage() {
  // Redirect to login after showing message
  useEffect(() => {
    // Optional: auto-redirect after a few seconds
    // const timer = setTimeout(() => {
    //   window.location.href = '/login'
    // }, 5000)
    // return () => clearTimeout(timer)
  }, [])

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Shield className="text-primary size-8" />
          </div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Sign Up Disabled</h1>
          <p className="text-muted-foreground mt-2 text-sm">Self-registration is not available</p>
        </div>

        {/* Message Card */}
        <div className="bg-card rounded-lg border p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold">Contact Your Administrator</h2>
          <p className="text-muted-foreground mb-6">
            New user accounts can only be created by an administrator. Please contact your admin to
            get access to this platform.
          </p>

          <div className="space-y-4">
            <Link href="/login">
              <Button className="w-full">Go to Login</Button>
            </Link>

            <Link href="/">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 size-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>

        {/* Admin link */}
        <p className="text-muted-foreground text-center text-sm">
          Are you an administrator?{' '}
          <Link href="/admin/login" className="text-primary font-medium hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  )
}
