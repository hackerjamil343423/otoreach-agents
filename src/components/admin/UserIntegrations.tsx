'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Database,
  Trash2,
  Play,
  Code,
  Copy,
  Check,
  AlertTriangle,
  Webhook,
  Send,
  Eye,
  EyeOff,
  Info
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface UserIntegrationsProps {
  userId: string
}

interface ConfigStatus {
  is_configured: boolean
  has_service_role?: boolean
  use_service_role?: boolean
  schema_initialized?: boolean
  last_verified_at?: string
  project_bucket_name?: string
}

interface WebhookConfig {
  webhook_url: string
}

interface TestResult {
  success: boolean
  message: string
  credentialType?: 'service_role' | 'anon'
  isAdmin?: boolean
  schemaStatus?: {
    initialized: boolean
    existingTables: string[]
    missingTables: string[]
  }
  responseTime?: number
}

export function UserIntegrations({ userId }: UserIntegrationsProps) {
  const [config, setConfig] = useState({
    supabaseUrl: '',
    supabaseAnonKey: '',
    serviceRoleSecret: '',
    projectBucketName: 'projects',
    useServiceRole: true
  })
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    webhook_url: ''
  })
  const [status, setStatus] = useState<ConfigStatus>({ is_configured: false })
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [sqlScript, setSqlScript] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Webhook state
  const [webhookSaving, setWebhookSaving] = useState(false)
  const [webhookTesting, setWebhookTesting] = useState(false)
  const [webhookTestResult, setWebhookTestResult] = useState<TestResult | null>(null)

  // Visibility toggles for showing sensitive data
  const [showWebhookUrl, setShowWebhookUrl] = useState(false)
  const [showConfigSummary, setShowConfigSummary] = useState(true)

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/supabase-config`)
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
        if (data.project_bucket_name) {
          setConfig(prev => ({ ...prev, projectBucketName: data.project_bucket_name }))
        }
        if (data.use_service_role !== undefined) {
          setConfig(prev => ({ ...prev, useServiceRole: data.use_service_role }))
        }
      }
    } catch (error) {
      console.error('Failed to load Supabase config:', error)
    }
  }, [userId])

  const loadWebhookConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.user?.webhook_url) {
          setWebhookConfig({ webhook_url: data.user.webhook_url })
        }
      }
    } catch (error) {
      console.error('Failed to load webhook config:', error)
    }
  }, [userId])

  const loadSqlScript = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/supabase-config/init`)
      if (res.ok) {
        const data = await res.json()
        setSqlScript(data.sql)
      }
    } catch (error) {
      console.error('Failed to load SQL script:', error)
    }
  }, [userId])

  useEffect(() => {
    void loadConfig()
    void loadWebhookConfig()
    void loadSqlScript()
  }, [loadConfig, loadWebhookConfig, loadSqlScript])

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
        setStatus(prev => ({ ...prev, is_configured: true }))
        setTestResult({
          success: true,
          message: 'Configuration saved successfully',
          credentialType: config.useServiceRole ? 'service_role' : 'anon'
        })
        // Clear sensitive data from form
        setConfig(prev => ({
          ...prev,
          supabaseAnonKey: '',
          serviceRoleSecret: ''
        }))
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
        setTestResult({
          success: true,
          message: `Connection successful! (${data.credentialType === 'service_role' ? 'Service Role' : 'Anon Key'})`,
          credentialType: data.credentialType,
          isAdmin: data.isAdmin,
          schemaStatus: data.schemaStatus
        })
        // Update status
        setStatus(prev => ({
          ...prev,
          schema_initialized: data.schemaStatus?.initialized ?? prev.schema_initialized
        }))
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Connection failed',
          credentialType: data.credentialType
        })
      }
    } catch {
      setTestResult({ success: false, message: 'Failed to test connection' })
    } finally {
      setTesting(false)
    }
  }

  async function initializeSchema() {
    setInitializing(true)
    setTestResult(null)

    try {
      const res = await fetch(`/api/admin/users/${userId}/supabase-config/init`, {
        method: 'POST'
      })
      const data = await res.json()

      if (data.success) {
        setTestResult({
          success: true,
          message: `Schema initialized! Created tables: ${data.createdTables?.join(', ') || 'N/A'}`,
          schemaStatus: data.schemaStatus
        })
        setStatus(prev => ({ ...prev, schema_initialized: true }))
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Schema initialization failed'
        })
      }
    } catch {
      setTestResult({ success: false, message: 'Failed to initialize schema' })
    } finally {
      setInitializing(false)
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
        setStatus({ is_configured: false })
        setTestResult({ success: true, message: 'Configuration removed' })
      } else {
        setTestResult({ success: false, message: 'Failed to remove configuration' })
      }
    } catch {
      setTestResult({ success: false, message: 'Network error. Please try again.' })
    }
  }

  function copySqlScript() {
    navigator.clipboard.writeText(sqlScript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Webhook handlers
  async function saveWebhookConfig() {
    setWebhookSaving(true)
    setWebhookTestResult(null)

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: webhookConfig.webhook_url || null })
      })

      const data = await res.json()

      if (res.ok) {
        setWebhookTestResult({
          success: true,
          message: 'Webhook URL saved successfully'
        })
      } else {
        setWebhookTestResult({
          success: false,
          message: data.error || 'Failed to save webhook URL'
        })
      }
    } catch {
      setWebhookTestResult({
        success: false,
        message: 'Network error. Please try again.'
      })
    } finally {
      setWebhookSaving(false)
    }
  }

  async function testWebhook() {
    if (!webhookConfig.webhook_url) {
      setWebhookTestResult({
        success: false,
        message: 'Please enter a webhook URL first'
      })
      return
    }

    setWebhookTesting(true)
    setWebhookTestResult(null)

    try {
      const res = await fetch('/api/admin/webhook/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: webhookConfig.webhook_url })
      })

      const data = await res.json()

      if (data.success) {
        setWebhookTestResult({
          success: true,
          message: `Webhook responded successfully (${data.responseTime}ms)`,
          responseTime: data.responseTime
        })
      } else {
        setWebhookTestResult({
          success: false,
          message: data.error || 'Webhook test failed'
        })
      }
    } catch {
      setWebhookTestResult({ success: false, message: 'Failed to test webhook' })
    } finally {
      setWebhookTesting(false)
    }
  }

  const hasWebhookUrl = !!webhookConfig.webhook_url

  // Helper to mask/show webhook URL
  const displayWebhookUrl = showWebhookUrl
    ? webhookConfig.webhook_url
    : webhookConfig.webhook_url
      ? `${webhookConfig.webhook_url.substring(0, 30)}...${webhookConfig.webhook_url.slice(-10)}`
      : ''

  return (
    <div className="space-y-4">
      {/* Configuration Summary Card - Shows all configured values */}
      {(hasWebhookUrl || status.is_configured) && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-primary" />
                Configuration Summary
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfigSummary(!showConfigSummary)}
                className="h-7"
              >
                {showConfigSummary ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          {showConfigSummary && (
            <CardContent className="pt-0">
              <div className="space-y-3 text-sm">
                {/* Webhook Configuration Display */}
                {hasWebhookUrl && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-muted-foreground">Webhook URL:</span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-background px-2 py-0.5 rounded">
                          {displayWebhookUrl || 'Not set'}
                        </code>
                        {webhookConfig.webhook_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setShowWebhookUrl(!showWebhookUrl)}
                          >
                            {showWebhookUrl ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    </div>
                    {webhookTestResult?.success && (
                      <div className="flex items-center gap-2 text-green-600 text-xs">
                        <CheckCircle className="h-3 w-3" />
                        <span>Test passed {webhookTestResult.responseTime && `(${webhookTestResult.responseTime}ms)`}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Supabase Configuration Display */}
                {status.is_configured && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="font-medium text-muted-foreground text-xs">Supabase Configuration:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Status:</span>{' '}
                        <Badge variant="outline" className="ml-1">
                          {status.is_configured ? 'Configured' : 'Not Configured'}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Service Role:</span>{' '}
                        <Badge variant={status.has_service_role ? 'default' : 'secondary'} className="ml-1">
                          {status.has_service_role ? 'Enabled' : 'Not Set'}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Schema:</span>{' '}
                        <Badge variant={status.schema_initialized ? 'default' : 'secondary'} className="ml-1">
                          {status.schema_initialized ? 'Ready' : 'Not Init'}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bucket:</span>{' '}
                        <span className="font-mono">{status.project_bucket_name || 'N/A'}</span>
                      </div>
                    </div>
                    {testResult?.success && testResult.schemaStatus && (
                      <div className="text-xs pt-1">
                        <span className="text-muted-foreground">Tables:</span>{' '}
                        <span className={testResult.schemaStatus.initialized ? 'text-green-600' : 'text-amber-600'}>
                          {testResult.schemaStatus.initialized
                            ? `✓ ${testResult.schemaStatus.existingTables.length} tables ready`
                            : `⚠ ${testResult.schemaStatus.missingTables.length} tables missing`
                          }
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Webhook Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            File Webhook Integration
          </CardTitle>
          <CardDescription>
            Configure a webhook URL to receive file data when files are created or updated
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={hasWebhookUrl ? 'default' : 'secondary'}>
              {hasWebhookUrl ? 'Configured' : 'Not Configured'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              placeholder="https://your-server.com/webhook/file-events"
              value={webhookConfig.webhook_url}
              onChange={(e) => setWebhookConfig({ webhook_url: e.target.value })}
              disabled={webhookSaving || webhookTesting}
            />
            <p className="text-muted-foreground text-xs">
              This URL will receive POST requests with file content and metadata whenever
              files are created or updated in the user&apos;s projects.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={saveWebhookConfig}
              disabled={webhookSaving}
            >
              {webhookSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {hasWebhookUrl ? 'Update Webhook' : 'Save Webhook'}
            </Button>
            <Button
              variant="outline"
              onClick={testWebhook}
              disabled={webhookTesting || !webhookConfig.webhook_url}
            >
              {webhookTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Test Webhook
            </Button>
          </div>

          {webhookTestResult && (
            <div className={`flex flex-col gap-2 rounded-md p-3 text-sm ${
              webhookTestResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              <div className="flex items-start gap-2">
                {webhookTestResult.success ? (
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <span>{webhookTestResult.message}</span>
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
            <h4 className="font-medium text-sm">Webhook Payload Format</h4>
            <p className="text-muted-foreground text-xs">
              When files are created or updated, your webhook will receive a POST request with this JSON payload:
            </p>
            <pre className="overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-50">
{`{
  "event": "file.created" | "file.updated",
  "timestamp": "2026-02-07T12:00:00Z",
  "user_id": "user-uuid",
  "file": {
    "id": "file-uuid",
    "name": "document.txt",
    "description": "File description",
    "content": "Full file content...",
    "file_type": "text",
    "size_bytes": 1024,
    "project_id": "project-uuid",
    "sub_project_id": "sub-project-uuid"
  },
  "project": {
    "id": "project-uuid",
    "name": "Project Name"
  },
  "sub_project": {
    "id": "sub-project-uuid",
    "name": "Sub Project Name"
  }
}`}
            </pre>
            <div className="text-muted-foreground text-xs space-y-1">
              <p className="font-medium">Headers included:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code>Content-Type: application/json</code></li>
                <li><code>X-Webhook-Event: file.created | file.updated</code></li>
                <li><code>X-Webhook-Attempt: 1-3</code> (retry count)</li>
                <li><code>X-Webhook-User-Id: user-uuid</code></li>
                <li><code>X-Webhook-File-Id: file-uuid</code></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supabase Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Supabase Integration
          </CardTitle>
          <CardDescription>
            Configure the user&apos;s Supabase project for full database access
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={status.is_configured ? 'default' : 'secondary'}>
              {status.is_configured ? 'Configured' : 'Not Configured'}
            </Badge>
            {status.has_service_role && (
              <Badge variant="outline" className="text-green-600">
                Service Role
              </Badge>
            )}
            {status.schema_initialized && (
              <Badge variant="outline" className="text-blue-600">
                Schema Ready
              </Badge>
            )}
            {status.last_verified_at && (
              <span className="text-muted-foreground text-sm">
                Last verified: {new Date(status.last_verified_at).toLocaleString()}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="credentials" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="credentials">Credentials</TabsTrigger>
              <TabsTrigger value="setup">Setup SQL</TabsTrigger>
            </TabsList>

            <TabsContent value="credentials" className="space-y-4">
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
                <Label htmlFor="serviceRoleSecret">Service Role Secret (Recommended)</Label>
                <Input
                  id="serviceRoleSecret"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={config.serviceRoleSecret}
                  onChange={(e) => setConfig({ ...config, serviceRoleSecret: e.target.value })}
                  disabled={saving}
                />
                <p className="text-muted-foreground text-xs">
                  <strong>Service Role Secret</strong> from Project Settings → API.
                  Provides full database access (bypasses RLS).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supabaseAnonKey">Anon Key (Optional)</Label>
                <Input
                  id="supabaseAnonKey"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={config.supabaseAnonKey}
                  onChange={(e) => setConfig({ ...config, supabaseAnonKey: e.target.value })}
                  disabled={saving}
                />
                <p className="text-muted-foreground text-xs">
                  <strong>Anon/Public Key</strong> - Only needed if not using Service Role.
                  Limited access respecting RLS policies.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="useServiceRole" className="text-base">Use Service Role</Label>
                  <p className="text-muted-foreground text-xs">
                    Enable full database access for querying and modifying data
                  </p>
                </div>
                <Switch
                  id="useServiceRole"
                  checked={config.useServiceRole}
                  onCheckedChange={(checked) => setConfig({ ...config, useServiceRole: checked })}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectBucketName">Storage Bucket Name</Label>
                <Input
                  id="projectBucketName"
                  placeholder="projects"
                  value={config.projectBucketName}
                  onChange={(e) => setConfig({ ...config, projectBucketName: e.target.value })}
                  disabled={saving}
                />
                <p className="text-muted-foreground text-xs">
                  Storage bucket name for file uploads (will be created if it doesn&apos;t exist)
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={saveConfig}
                  disabled={saving || !config.supabaseUrl || (!config.supabaseAnonKey && !config.serviceRoleSecret)}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {status.is_configured ? 'Update Configuration' : 'Save Configuration'}
                </Button>
                <Button
                  variant="outline"
                  onClick={testConnection}
                  disabled={testing || !status.is_configured}
                >
                  {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Test Connection
                </Button>
                {status.has_service_role && !status.schema_initialized && (
                  <Button
                    variant="secondary"
                    onClick={initializeSchema}
                    disabled={initializing || !status.is_configured}
                  >
                    {initializing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Init Schema
                  </Button>
                )}
                {status.is_configured && (
                  <Button variant="destructive" onClick={deleteConfig} disabled={saving}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>

              {testResult && (
                <div className={`flex flex-col gap-2 rounded-md p-3 text-sm ${
                  testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  <div className="flex items-start gap-2">
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>

                  {testResult.schemaStatus && (
                    <div className="mt-2 text-xs">
                      <p className="font-medium">Schema Status:</p>
                      <p>
                        {testResult.schemaStatus.initialized
                          ? `✓ All tables ready (${testResult.schemaStatus.existingTables.length} tables)`
                          : `⚠ Missing tables: ${testResult.schemaStatus.missingTables.join(', ')}`
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="setup" className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Run this SQL in the user&apos;s Supabase SQL Editor to create the required tables.
                  This enables full database integration.
                </AlertDescription>
              </Alert>

              <div className="relative">
                <div className="absolute right-2 top-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copySqlScript}
                    className="h-8 gap-1"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-50">
                  <code>{sqlScript || '-- Loading SQL script...'}</code>
                </pre>
              </div>

              <div className="text-muted-foreground text-sm space-y-1">
                <p className="font-medium">Setup Instructions:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to the user&apos;s Supabase project dashboard</li>
                  <li>Navigate to SQL Editor</li>
                  <li>Create a New Query</li>
                  <li>Paste the SQL above</li>
                  <li>Click Run to create the tables</li>
                  <li>Return here and click &quot;Test Connection&quot; to verify</li>
                </ol>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            What You Can Do With Service Role
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-1">
            <p className="font-medium">✓ Full Database Access</p>
            <p className="text-muted-foreground">
              Query, insert, update, and delete data in the user&apos;s Supabase project.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">✓ Bypass Row Level Security (RLS)</p>
            <p className="text-muted-foreground">
              Access all data regardless of RLS policies. Use with caution.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">✓ Create Tables & Indexes</p>
            <p className="text-muted-foreground">
              Programmatically create tables, indexes, and functions in the user&apos;s database.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">⚠ Security Warning</p>
            <p className="text-muted-foreground">
              Service Role Secret has full admin access. Never expose it in client-side code.
              It is safely encrypted in our database.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
