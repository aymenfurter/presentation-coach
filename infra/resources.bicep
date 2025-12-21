@description('The location used for all deployed resources')
param location string = resourceGroup().location

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Whether the presentation coach container app already exists')
param presentationcoachExists bool

@description('Whether to use Azure AI Foundry Agents')
param useFoundryAgents bool

@description('Whether to deploy Content Understanding service')
param useContentUnderstanding bool = true

@description('Location for Content Understanding service (limited availability)')
param contentUnderstandingLocation string = 'westus'

@description('Id of the user or app to assign application roles')
param principalId string

@description('Principal type of user or app')
param principalType string

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = uniqueString(subscription().id, resourceGroup().id, location)

// Model deployment configuration
param gptModelName string = 'gpt-4o'
param gptModelVersion string = '2024-08-06'
param gptDeploymentName string = 'gpt-4o'

param openAiModelDeployments array = [
  {
    name: gptDeploymentName
    model: gptModelName
    version: gptModelVersion
    sku: {
      name: 'Standard'
      capacity: 10
    }
  }
  {
    name: 'gpt-4.1-mini'
    model: 'gpt-4.1-mini'
    version: '2025-04-14'
    sku: {
      name: 'Standard'
      capacity: 10
    }
  }
]

// AI Foundry Resource (Azure AI Services)
resource aiFoundryResource 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: 'aifoundry-pcoach-${resourceToken}'
  location: location
  tags: tags
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: 'aifoundry-pcoach-${resourceToken}'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }

  @batchSize(1)
  resource deployment 'deployments' = [
    for deployment in openAiModelDeployments: {
      name: deployment.name
      sku: deployment.?sku ?? {
        name: 'Standard'
        capacity: 20
      }
      properties: {
        model: {
          format: 'OpenAI'
          name: deployment.model
          version: deployment.?version ?? null
        }
        raiPolicyName: deployment.?raiPolicyName ?? null
        versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
      }
    }
  ]
}

// Speech Service
resource speechService 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: 'speech-pcoach-${resourceToken}'
  location: location
  tags: tags
  kind: 'SpeechServices'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: 'speech-pcoach-${resourceToken}'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

// Content Understanding Service (deployed to westus due to limited availability)
resource contentUnderstandingService 'Microsoft.CognitiveServices/accounts@2024-10-01' = if (useContentUnderstanding) {
  name: '${abbrs.cognitiveServicesContentUnderstanding}pcoach-${resourceToken}'
  location: contentUnderstandingLocation
  tags: tags
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: '${abbrs.cognitiveServicesContentUnderstanding}pcoach-${resourceToken}'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

// Monitor application with Azure Monitor
module monitoring 'br/public:avm/ptn/azd/monitoring:0.1.0' = {
  name: 'monitoring'
  params: {
    logAnalyticsName: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
    applicationInsightsName: '${abbrs.insightsComponents}${resourceToken}'
    applicationInsightsDashboardName: '${abbrs.portalDashboards}${resourceToken}'
    location: location
    tags: tags
  }
}

// Container registry
module containerRegistry 'br/public:avm/res/container-registry/registry:0.1.1' = {
  name: 'registry'
  params: {
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
    location: location
    tags: tags
    publicNetworkAccess: 'Enabled'
    roleAssignments: [
      {
        principalId: presentationcoachIdentity.outputs.principalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: subscriptionResourceId(
          'Microsoft.Authorization/roleDefinitions',
          '7f951dda-4ed3-4680-a7ca-43fe172d538d'
        )
      }
    ]
  }
}

// Container apps environment
module containerAppsEnvironment 'br/public:avm/res/app/managed-environment:0.4.5' = {
  name: 'container-apps-environment'
  params: {
    logAnalyticsWorkspaceResourceId: monitoring.outputs.logAnalyticsWorkspaceResourceId
    name: '${abbrs.appManagedEnvironments}${resourceToken}'
    location: location
    zoneRedundant: false
  }
}

// Managed Identity for the container app
module presentationcoachIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.2.1' = {
  name: 'presentationcoachidentity'
  params: {
    name: '${abbrs.managedIdentityUserAssignedIdentities}pcoach-${resourceToken}'
    location: location
  }
}

// Fetch existing container image if the app already exists
module presentationcoachFetchLatestImage './modules/fetch-container-image.bicep' = {
  name: 'presentationcoach-fetch-image'
  params: {
    exists: presentationcoachExists
    name: 'presentationcoach'
  }
}

// Container App for Presentation Coach
module presentationcoach 'br/public:avm/res/app/container-app:0.8.0' = {
  name: 'presentationcoach'
  params: {
    name: 'presentationcoach'
    ingressTargetPort: 8015
    ingressExternal: true
    ingressTransport: 'http'
    scaleMinReplicas: 1
    scaleMaxReplicas: 10
    secrets: {
      secureList: [
        {
          name: 'ai-foundry-api-key'
          value: aiFoundryResource.listKeys().key1
        }
        {
          name: 'speech-api-key'
          value: speechService.listKeys().key1
        }
        {
          name: 'content-understanding-key'
          value: useContentUnderstanding && contentUnderstandingService != null ? contentUnderstandingService!.listKeys().key1 : ''
        }
      ]
    }
    containers: [
      {
        image: presentationcoachFetchLatestImage.outputs.?containers[?0].?image ?? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        name: 'main'
        resources: {
          cpu: json('1.0')
          memory: '2.0Gi'
        }
        env: [
          {
            name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
            value: monitoring.outputs.applicationInsightsConnectionString
          }
          {
            name: 'AZURE_CLIENT_ID'
            value: presentationcoachIdentity.outputs.clientId
          }
          {
            name: 'AZURE_OPENAI_ENDPOINT'
            value: aiFoundryResource.properties.endpoint
          }
          {
            name: 'AZURE_OPENAI_API_KEY'
            secretRef: 'ai-foundry-api-key'
          }
          {
            name: 'PROJECT_ENDPOINT'
            value: '${aiFoundryResource.properties.endpoint}api/projects/default-project'
          }
          {
            name: 'MODEL_DEPLOYMENT_NAME'
            value: gptDeploymentName
          }
          {
            name: 'ANALYSIS_MODEL_DEPLOYMENT_NAME'
            value: 'gpt-4.1-mini'
          }
          {
            name: 'AZURE_SPEECH_KEY'
            secretRef: 'speech-api-key'
          }
          {
            name: 'AZURE_SPEECH_REGION'
            value: location
          }
          {
            name: 'AZURE_AI_RESOURCE_NAME'
            value: aiFoundryResource.name
          }
          {
            name: 'AZURE_AI_REGION'
            value: location
          }
          {
            name: 'CONTENT_UNDERSTANDING_ENDPOINT'
            value: useContentUnderstanding && contentUnderstandingService != null ? contentUnderstandingService!.properties.endpoint : ''
          }
          {
            name: 'CONTENT_UNDERSTANDING_KEY'
            secretRef: 'content-understanding-key'
          }
          {
            name: 'SUBSCRIPTION_ID'
            value: subscription().subscriptionId
          }
          {
            name: 'RESOURCE_GROUP_NAME'
            value: resourceGroup().name
          }
          {
            name: 'USE_AZURE_AI_AGENTS'
            value: useFoundryAgents ? 'true' : 'false'
          }
          {
            name: 'PORT'
            value: '8015'
          }
          {
            name: 'HOST'
            value: '0.0.0.0'
          }
        ]
      }
    ]
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [presentationcoachIdentity.outputs.resourceId]
    }
    registries: [
      {
        server: containerRegistry.outputs.loginServer
        identity: presentationcoachIdentity.outputs.resourceId
      }
    ]
    environmentResourceId: containerAppsEnvironment.outputs.resourceId
    location: location
    tags: union(tags, { 'azd-service-name': 'presentationcoach' })
  }
}

// Role Assignments for Container App Identity

// Azure AI Developer role
resource containerAppAzureAIDeveloperRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, presentationcoach.name, '64702f94-c441-49e6-a78b-ef80e0188fee')
  properties: {
    principalId: presentationcoachIdentity.outputs.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '64702f94-c441-49e6-a78b-ef80e0188fee')
  }
}

// Cognitive Services User role
resource containerAppCognitiveServicesUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, presentationcoach.name, 'a97b65f3-24c7-4388-baec-2e87135dc908')
  properties: {
    principalId: presentationcoachIdentity.outputs.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', 'a97b65f3-24c7-4388-baec-2e87135dc908')
  }
}

// Cognitive Services OpenAI User role
resource containerAppCognitiveServicesOpenAIUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, presentationcoach.name, '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
  properties: {
    principalId: presentationcoachIdentity.outputs.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
  }
}

// User role assignments (for logged-in user during development)

// Azure AI Developer role for user
resource userAzureAIDeveloperRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(resourceGroup().id, principalId, '64702f94-c441-49e6-a78b-ef80e0188fee')
  properties: {
    principalId: principalId
    principalType: principalType
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '64702f94-c441-49e6-a78b-ef80e0188fee')
  }
}

// Cognitive Services OpenAI User role for user
resource userCognitiveServicesOpenAIUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(resourceGroup().id, principalId, '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
  properties: {
    principalId: principalId
    principalType: principalType
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
  }
}

// Outputs
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.outputs.loginServer
output AZURE_RESOURCE_PRESENTATIONCOACH_ID string = presentationcoach.outputs.resourceId
output AZURE_CONTAINER_APP_ENVIRONMENT_NAME string = containerAppsEnvironment.name
output AZURE_CONTAINER_APP_NAME string = presentationcoach.name
output SERVICE_PRESENTATIONCOACH_URI string = 'https://${presentationcoach.outputs.fqdn}'
output AZURE_TENANT_ID string = subscription().tenantId
output AZURE_SUBSCRIPTION_ID string = subscription().subscriptionId
output PRESENTATIONCOACH_IDENTITY_PRINCIPAL_ID string = presentationcoachIdentity.outputs.principalId
output PROJECT_ENDPOINT string = '${aiFoundryResource.properties.endpoint}api/projects/default-project'
output AZURE_OPENAI_ENDPOINT string = aiFoundryResource.properties.endpoint
output AZURE_SPEECH_REGION string = location
output AI_FOUNDRY_RESOURCE_NAME string = aiFoundryResource.name
output CONTENT_UNDERSTANDING_ENDPOINT string = useContentUnderstanding && contentUnderstandingService != null ? contentUnderstandingService!.properties.endpoint : ''
