"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { 
  Plus, 
  Key, 
  Copy, 
  Trash2, 
  Eye, 
  EyeOff,
  Search,
  Bot,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Edit,
  Building2,
  User
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { format } from "date-fns"
import { useOrganizationScope } from "@/hooks/use-organization-scope"
import { useOrganization } from "@/hooks/use-organization"

interface ApiKey {
  id: string
  name: string
  shortKey: string
  agentIds: string[]
  agentNames: string[]
  createdAt: string
  lastUsed: string | null
  isActive: boolean
  description?: string
  fullApiKey?: string // Only present in creation response
}

interface Agent {
  id: string
  name: string
}

const fetchApiKeys = async ({ 
  pageSize, 
  currentPage,
  search,
  organizationId
}: { 
  pageSize: string; 
  currentPage: number;
  search?: string;
  organizationId?: string | null;
}) => {
  const params = new URLSearchParams({
    page: currentPage.toString(),
    limit: pageSize
  })

  if (search) {
    params.append('search', search)
  }

  // Add organization scoping
  if (organizationId) {
    params.append('organizationId', organizationId)
  }

  const response = await apiClient.get(`/api-keys?${params.toString()}`)
  return response.data
}

const fetchAgents = async ({ organizationId }: { organizationId?: string | null }): Promise<{ data: Agent[] }> => {
  const params = new URLSearchParams()
  
  // Add organization scoping
  if (organizationId) {
    params.append('organizationId', organizationId)
  }
  
  const response = await apiClient.get(`/agents/list?${params.toString()}`)
  return response.data
}

const createApiKey = async (data: {
  name: string
  agentIds: string[]
  description?: string
  organizationId?: string | null
}): Promise<{status: number, data: ApiKey, message: string}> => {
  const response = await apiClient.post("/api-keys", data)
  
  // Ensure we have a fullApiKey in the response
  if (!response.data?.data?.fullApiKey) {
    throw new Error("API response missing fullApiKey property")
  }
  
  return response.data
}

const deleteApiKey = async (id: string): Promise<void> => {
  await apiClient.delete(`/api-keys/${id}`)
}

const updateApiKey = async (data: {
  id: string
  name: string
  description?: string
  agentIds: string[]
  isActive: boolean
}): Promise<ApiKey> => {
  const response = await apiClient.patch(`/api-keys/${data.id}`, {
    name: data.name,
    description: data.description,
    agentIds: data.agentIds,
    isActive: data.isActive,
  })
  return response.data
}

export default function ApiKeysPage() {
  const { organizationId, isPersonalAccount, scope, isInitialized } = useOrganizationScope()
  const { activeOrganization } = useOrganization()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [pageSize, setPageSize] = useState("20")
  const [currentPage, setCurrentPage] = useState(1)
  // Form dialog state (unified for create/edit)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingApiKey, setEditingApiKey] = useState<ApiKey | null>(null)
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formSelectedAgents, setFormSelectedAgents] = useState<string[]>([])
  const [formSelectAllAgents, setFormSelectAllAgents] = useState(false)
  const [formIsActive, setFormIsActive] = useState(true)
  
  // Other state
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [agentFilter, setAgentFilter] = useState("all")
  const [showCreatedKey, setShowCreatedKey] = useState<string | null>(null)
  const [keyWasCopied, setKeyWasCopied] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [apiKeyToDelete, setApiKeyToDelete] = useState<ApiKey | null>(null)
  const [viewAgentsModal, setViewAgentsModal] = useState<{ open: boolean; agents: string[]; keyName: string } | null>(null)


  const queryClient = useQueryClient()

  // Form management functions
  const resetForm = () => {
    setEditingApiKey(null)
    setFormName("")
    setFormDescription("")
    setFormSelectedAgents([])
    setFormSelectAllAgents(false)
    setFormIsActive(true)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (apiKey: ApiKey) => {
    setEditingApiKey(apiKey)
    setFormName(apiKey.name)
    setFormDescription(apiKey.description || "")
    setFormSelectedAgents(apiKey.agentIds)
    setFormIsActive(apiKey.isActive)
    setFormSelectAllAgents(apiKey.agentIds.length === (agents?.data?.length || 0) && (agents?.data?.length || 0) > 0)
    setIsDialogOpen(true)
  }

  // Handle search term changes with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setCurrentPage(1) // Reset to first page on search
    }, 300) // 300ms debounce delay

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['api-keys', currentPage, pageSize, debouncedSearchTerm, organizationId],
    queryFn: () => fetchApiKeys({ pageSize, currentPage, search: debouncedSearchTerm, organizationId }),
  })

  const { data: agents } = useQuery({
    queryKey: ['agents', organizationId],
    queryFn: () => fetchAgents({ organizationId }),
  })

  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (response) => {
      
      // Keep track of the full API key from the nested data structure
      const fullKey = response.data?.fullApiKey
      
      // Reset form state
      resetForm()
      setKeyWasCopied(false)
      
      // Close dialog first
      setIsDialogOpen(false)
      
      // Use a more reliable approach with a separate useEffect
      // rather than a setTimeout
      if (fullKey) {
        // Handle this in a separate tick of the event loop to avoid React state batching issues
        Promise.resolve().then(() => {
          setShowCreatedKey(fullKey)
        })
      } else {
        console.error("No fullApiKey in response data:", response)
        toast.error("API key created but couldn't display the full key")
      }
      
      // Invalidate queries and show success toast
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success("API key created successfully")
      
    },
    onError: (error) => {
      console.error("Failed to create API key:", error)
      toast.error("Failed to create API key")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success("API key deleted successfully")
      setDeleteConfirmOpen(false)
      setApiKeyToDelete(null)
    },
    onError: () => {
      toast.error("Failed to delete API key")
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      resetForm()
      setIsDialogOpen(false)
      toast.success("API key updated successfully")
    },
    onError: () => {
      toast.error("Failed to update API key")
    },
  })

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast.error("Please enter a name for the API key")
      return
    }

    if (formSelectedAgents.length === 0) {
      toast.error("Please select at least one agent")
      return
    }

    if (editingApiKey) {
      // Update existing API key
      updateMutation.mutate({
        id: editingApiKey.id,
        name: formName,
        description: formDescription || undefined,
        agentIds: formSelectedAgents,
        isActive: formIsActive,
      })
    } else {
      // Create new API key
      createMutation.mutate({
        name: formName,
        agentIds: formSelectedAgents,
        description: formDescription || undefined,
        organizationId: organizationId || undefined,
      })
    }
  }

  const handleDeleteClick = (apiKey: ApiKey) => {
    setApiKeyToDelete(apiKey)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (apiKeyToDelete) {
      deleteMutation.mutate(apiKeyToDelete.id)
    }
  }

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false)
    setApiKeyToDelete(null)
  }

  const handleSelectAllAgents = (checked: boolean) => {
    setFormSelectAllAgents(checked)
    if (checked) {
      setFormSelectedAgents(agents?.data.map(agent => agent.id) || [])
    } else {
      setFormSelectedAgents([])
    }
  }

  const handleAgentSelection = (agentId: string, checked: boolean) => {
    if (checked) {
      setFormSelectedAgents(prev => [...prev, agentId])
    } else {
      setFormSelectedAgents(prev => prev.filter(id => id !== agentId))
      setFormSelectAllAgents(false)
    }
  }

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev)
      if (newSet.has(keyId)) {
        newSet.delete(keyId)
      } else {
        newSet.add(keyId)
      }
      return newSet
    })
  }

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(keyId)
      toast.success("Copied to clipboard")
      
      // Set keyWasCopied to true when the created key is copied
      if (keyId === 'created-key') {
        setKeyWasCopied(true)
      }
      
      setTimeout(() => setCopiedKey(null), 2000)
    } catch (err) {
      toast.error("Failed to copy")
    }
  }

  const maskKey = (key: string) => {
    if (key.length <= 8) return key
    return `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`
  }

  // Calculate active filters count
  const activeFiltersCount = [
    statusFilter !== "all",
    agentFilter !== "all"
  ].filter(Boolean).length

  const clearFilters = () => {
    setStatusFilter("all")
    setAgentFilter("all")
  }

  // Filter data on frontend for status and agent filters (search is handled by API)
  const filteredApiKeys = apiKeys?.data.filter((apiKey: ApiKey) => {
    // Status filter
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && apiKey.isActive) ||
      (statusFilter === "inactive" && !apiKey.isActive)
    
    // Agent filter
    const matchesAgent = agentFilter === "all" || 
      apiKey.agentIds.includes(agentFilter)
    
    return matchesStatus && matchesAgent
  }) || []

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= (apiKeys?.pagination?.total_pages || 1)) {
      setCurrentPage(newPage)
    }
  }

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(newSize)
    setCurrentPage(1) // Reset to first page when changing page size
  }

  // Update formSelectAllAgents state when formSelectedAgents changes
  useEffect(() => {
    if (agents?.data) {
      setFormSelectAllAgents(formSelectedAgents.length === agents.data.length && agents.data.length > 0)
    }
  }, [formSelectedAgents, agents?.data])

  // Don't render the page until organization context is initialized
  if (!isInitialized) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            {/* <p className="text-muted-foreground">Loading organization context...</p> */}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">API Keys</h1>
          <p className="text-muted-foreground">
            {isPersonalAccount 
              ? "Manage your personal API keys" 
              : `Manage API keys for ${activeOrganization?.name || scope}`
            }
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New API Key
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="relative">
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filters</h4>
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Agent</Label>
                    <Select value={agentFilter} onValueChange={setAgentFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Agents</SelectItem>
                        {agents?.data?.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search API keys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              {searchTerm && !isLoading && (
                <X 
                  className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" 
                  onClick={() => setSearchTerm("")}
                />
              )}
              {isLoading && searchTerm && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              )}
            </div>
          </div>
          

        </div>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <span>Status: {statusFilter}</span>
              <X 
                className="h-3 w-3 cursor-pointer hover:text-foreground" 
                onClick={() => setStatusFilter("all")}
              />
            </Badge>
          )}
          {agentFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <span>Agent: {agents?.data?.find(a => a.id === agentFilter)?.name}</span>
              <X 
                className="h-3 w-3 cursor-pointer hover:text-foreground" 
                onClick={() => setAgentFilter("all")}
              />
            </Badge>
          )}
        </div>
      )}

      {/* API Keys Grid */}
      {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-2/3"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-8 bg-muted rounded w-16"></div>
                    <div className="h-8 bg-muted rounded w-20"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

      ) : filteredApiKeys.length === 0 ? (
        <div className="text-center py-12">
          <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="mt-4 text-lg font-semibold">No API keys found</h3>
          <p className="text-muted-foreground">
            {searchTerm ? "Try adjusting your search terms" : "Get started by creating your first API key"}
          </p>
          {!searchTerm && (
            <Button className="mt-4" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
          {filteredApiKeys.map((apiKey: ApiKey) => (
            <Card key={apiKey.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <Key className="h-5 w-5 text-primary flex-shrink-0" />
                    <CardTitle className="text-lg truncate">{apiKey.name}</CardTitle>
                  </div>
                  <Badge variant={apiKey.isActive ? "default" : "secondary"} className="flex-shrink-0">
                    {apiKey.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">API Key:</span>
                    <div className="flex items-center space-x-2">
                      <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                        {apiKey.shortKey}{'*'.repeat(10)}
                      </code>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{format(new Date(apiKey.createdAt), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Used:</span>
                    <span>{apiKey.lastUsed ? format(new Date(apiKey.lastUsed), 'MMM d, yyyy') : "Never"}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Agents:</span>
                    <div className="flex items-center gap-1 mt-1 min-h-6">
                      {apiKey.agentNames.slice(0, 2).map((name, index) => (
                        <Badge key={index} variant="secondary" className="text-xs whitespace-nowrap">
                          {name}
                        </Badge>
                      ))}
                      {apiKey.agentNames.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground whitespace-nowrap"
                          onClick={() => setViewAgentsModal({ open: true, agents: apiKey.agentNames, keyName: apiKey.name })}
                        >
                          +{apiKey.agentNames.length - 2} more
                        </Button>
                      )}
                      {apiKey.agentNames.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">No agents assigned</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openEditDialog(apiKey)}
                  >
                    <Edit className="mr-2 h-3 w-3" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteClick(apiKey)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {apiKeys?.pagination && apiKeys.pagination.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Showing {((apiKeys.pagination.page - 1) * apiKeys.pagination.limit) + 1} to{' '}
              {Math.min(apiKeys.pagination.page * apiKeys.pagination.limit, apiKeys.pagination.total_count)} of{' '}
              {apiKeys.pagination.total_count} entries
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <Select value={pageSize} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(apiKeys.pagination.page - 1)}
                disabled={apiKeys.pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {apiKeys.pagination.page} of {apiKeys.pagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(apiKeys.pagination.page + 1)}
                disabled={apiKeys.pagination.page >= apiKeys.pagination.total_pages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* One-time API Key Display Dialog */}
      <Dialog 
        open={!!showCreatedKey} 
        modal={true}
        onOpenChange={(open) => {
          if (!open && keyWasCopied) {
            setShowCreatedKey(null)
            setKeyWasCopied(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]" hideClose={true}>
          <DialogHeader>
            <DialogTitle>API Key Created Successfully</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
              <div className="flex items-start space-x-2">
                <div className="bg-yellow-400 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-yellow-900 text-xs font-bold">!</span>
                </div>
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Important: Save this API key now!</p>
                  <p>This is the only time you'll be able to see the full API key. After copying, you won't be able to see the complete key again.</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Your API Key:</label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 text-sm bg-muted px-3 py-2 rounded border">
                  {showCreatedKey}
                </code>
                <Button
                  variant={keyWasCopied ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => showCreatedKey && copyToClipboard(showCreatedKey, 'created-key')}
                >
                  <Copy className={`h-4 w-4 ${copiedKey === 'created-key' ? 'text-green-600' : ''}`} />
                </Button>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button 
                onClick={() => {
                  setShowCreatedKey(null)
                  setKeyWasCopied(false)
                }}
                disabled={!keyWasCopied}
              >
                {keyWasCopied ? "Close" : "Copy the key first"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unified Create/Edit API Key Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          resetForm()
        }
        setIsDialogOpen(open)
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingApiKey ? "Edit API Key" : "Create New API Key"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Name</Label>
              <Input
                id="keyName"
                placeholder="Enter API key name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keyDescription">Description (Optional)</Label>
              <Textarea
                id="keyDescription"
                placeholder="Describe what this API key will be used for"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Agent Access</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all-agents"
                    checked={formSelectAllAgents}
                    onCheckedChange={handleSelectAllAgents}
                  />
                  <Label htmlFor="select-all-agents" className="font-medium">
                    All Agents
                  </Label>
                </div>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {agents?.data.map((agent) => (
                    <div key={agent.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`agent-${agent.id}`}
                        checked={formSelectedAgents.includes(agent.id)}
                        onCheckedChange={(checked) => 
                          handleAgentSelection(agent.id, checked as boolean)
                        }
                      />
                      <Label htmlFor={`agent-${agent.id}`} className="flex items-center space-x-2">
                        <Bot className="h-4 w-4" />
                        <span>{agent.name}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {editingApiKey && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="active-status"
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                />
                <Label htmlFor="active-status">
                  {formIsActive ? "Active" : "Inactive"}
                </Label>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending 
                  ? (editingApiKey ? "Updating..." : "Creating...") 
                  : (editingApiKey ? "Update API Key" : "Create API Key")
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the API key "{apiKeyToDelete?.name}"? 
              This action cannot be undone and will immediately revoke access for any applications using this key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Agents Modal */}
      <Dialog open={!!viewAgentsModal} onOpenChange={() => setViewAgentsModal(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Agents for API Key: {viewAgentsModal?.keyName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                This API key has access to <span className="font-medium text-foreground">{viewAgentsModal?.agents.length || 0}</span> agents.
              </p>
              <Badge variant="secondary">
                {viewAgentsModal?.agents.length || 0} total
              </Badge>
            </div>
            <div className="border rounded-lg p-4 max-h-80 overflow-y-auto space-y-2 bg-muted/30">
              {viewAgentsModal?.agents.map((agentName, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-center w-6 h-6 bg-primary/10 rounded-full">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                  <span className="font-medium">{agentName}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setViewAgentsModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}