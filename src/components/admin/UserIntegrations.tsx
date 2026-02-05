'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, Database, Trash2 } from 'lucide-react'

interface UserIntegrationsProps {
  userId: string
}

export function UserIntegrations({ userId }: UserIntegrationsProps) {
  const [config, setConfig] = useState({
    supabaseUrl: '',
    supabaseAnonKey: '',
    projectBucketName: 'projects'
  })
  const [isConfigured, setIsConfigured] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [lastVerified, setLastVerified] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/supabase-config`)
      if (res.ok) {
        const data = await res.json()
        setIsConfigured(data.is_configured)
        if (data.last_verified_at) {
          setLastVerified(data.last_verified_at)
        }
        if (data.project_bucket_name) {
          setConfig(prev => ({ ...prev, projectBucketName: data.project_bucket_name }))
        }
      }
    } catch (error) {
      console.error('Failed to load Supabase config:', error)
    }
  }, [userId])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  async function saveConfig() {
    setSaving(true)
    setTestResult(null)

    try {
      const res = await fetch(`/api/admin/users/${userId}/supabase-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const data = await res.json()

      if (res.ok) {
        setIsConfigured(true)
        setTestResult({ success: true, message: 'Configuration saved successfully' })
        // Clear the sensitive data from form
        setConfig({
          supabaseUrl: '',
          supabaseAnonKey: '',
          projectBucketName: config.projectBucketName
        })
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to save configuration' })
      }
    } catch {
      setTestResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)

    try {
      const res = await fetch(`/api/admin/users/${userId}/supabase-config/test`, {
        method: 'POST'
      })
      const data = await res.json()

      if (data.success) {
        setTestResult({ success: true, message: 'Connection successful!' })
        setLastVerified(new Date().toISOString())
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' })
      }
    } catch {
      setTestResult({ success: false, message: 'Failed to test connection' })
    } finally {
      setTesting(false)
    }
  }

  async function deleteConfig() {
    if (!confirm('Are you sure you want to remove this Supabase configuration? The user will lose access to their projects.')) {
      return
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}/supabase-config`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setIsConfigured(false)
        setLastVerified(null)
        setTestResult({ success: true, message: 'Configuration removed' })
      } else {
        setTestResult({ success: false, message: 'Failed to remove configuration' })
      }
    } catch {
      setTestResult({ success: false, message: 'Network error. Please try again.' })
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Supabase Integration
          </CardTitle>
          <CardDescription>
            Configure the user&apos;s Supabase project for file storage in Projects feature
          </CardDescription>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={isConfigured ? 'default' : 'secondary'}>
              {isConfigured ? 'Configured' : 'Not Configured'}
            </Badge>
            {lastVerified && (
              <span className="text-muted-foreground text-sm">
                Last verified: {new Date(lastVerified).toLocaleString()}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supabaseUrl">Supabase URL</Label>
            <Input
              id="supabaseUrl"
              placeholder="https://your-project.supabase.co"
              value={config.supabaseUrl}
              onChange={(e) => setConfig({ ...config, supabaseUrl: e.target.value })}
              disabled={saving}
            />
            <p className="text-muted-foreground text-xs">
              The full URL of the user&apos;s Supabase project
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabaseAnonKey">Supabase Anon Key</Label>
            <Input
              id="supabaseAnonKey"
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={config.supabaseAnonKey}
              onChange={(e) => setConfig({ ...config, supabaseAnonKey: e.target.value })}
              disabled={saving}
            />
            <p className="text-muted-foreground text-xs">
              The anonymous/public key from the user&apos;s Supabase project settings
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectBucketName">Bucket Name</Label>
            <Input
              id="projectBucketName"
              placeholder="projects"
              value={config.projectBucketName}
              onChange={(e) => setConfig({ ...config, projectBucketName: e.target.value })}
              disabled={saving}
            />
            <p className="text-muted-foreground text-xs">
              Storage bucket name for project files (will be created if it doesn&apos;t exist)
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveConfig} disabled={saving || !config.supabaseUrl || !config.supabaseAnonKey}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isConfigured ? 'Update Configuration' : 'Save Configuration'}
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || !isConfigured}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Test Connection
            </Button>
            {isConfigured && (
              <Button variant="destructive" onClick={deleteConfig} disabled={saving}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            )}
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 rounded-md p-3 text-sm ${
              testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>How the user can get their Supabase credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-1">
            <p className="font-medium">1. Create a Supabase Project</p>
            <p className="text-muted-foreground">
              The user needs to create a free account at{' '}
              <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                supabase.com
              </a>{' '}
              and create a new project.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">2. Get Project URL</p>
            <p className="text-muted-foreground">
              Navigate to Project Settings → API and copy the Project URL.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">3. Get Anon Key</p>
            <p className="text-muted-foreground">
              In the same API settings, copy the anon/public key.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">4. Enter Credentials Above</p>
            <p className="text-muted-foreground">
              Paste the URL and key in the form above and save. The system will automatically create the storage bucket.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
