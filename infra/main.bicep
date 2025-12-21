targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment that can be used as part of naming resource convention')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Whether the presentation coach container app already exists')
param presentationcoachExists bool

@description('Id of the user or app to assign application roles')
param principalId string

@description('Principal type of user or app')
param principalType string

@description('Whether to use Azure AI Foundry Agents')
param useFoundryAgents bool = false

@description('Whether to deploy Content Understanding service')
param useContentUnderstanding bool = true

@description('Location for Content Understanding service (limited availability)')
param contentUnderstandingLocation string = 'westus'

// Tags that should be applied to all resources.
//
// Note that 'azd-service-name' tags should be applied separately to service host resources.
// Example usage:
//   tags: union(tags, { 'azd-service-name': <service name in azure.yaml> })
var tags = {
  'azd-env-name': environmentName
}

// Organize resources in a resource group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module resources 'resources.bicep' = {
  scope: rg
  name: 'resources'
  params: {
    location: location
    tags: tags
    principalId: principalId
    principalType: principalType
    presentationcoachExists: presentationcoachExists
    useFoundryAgents: useFoundryAgents
    useContentUnderstanding: useContentUnderstanding
    contentUnderstandingLocation: contentUnderstandingLocation
  }
}

// Outputs for azd
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.AZURE_CONTAINER_REGISTRY_ENDPOINT
output AZURE_RESOURCE_PRESENTATIONCOACH_ID string = resources.outputs.AZURE_RESOURCE_PRESENTATIONCOACH_ID
output AZURE_CONTAINER_APP_ENVIRONMENT_NAME string = resources.outputs.AZURE_CONTAINER_APP_ENVIRONMENT_NAME
output AZURE_CONTAINER_APP_NAME string = resources.outputs.AZURE_CONTAINER_APP_NAME
output SERVICE_PRESENTATIONCOACH_URI string = resources.outputs.SERVICE_PRESENTATIONCOACH_URI
output PROJECT_ENDPOINT string = resources.outputs.PROJECT_ENDPOINT
output AZURE_OPENAI_ENDPOINT string = resources.outputs.AZURE_OPENAI_ENDPOINT
output AZURE_SPEECH_REGION string = resources.outputs.AZURE_SPEECH_REGION
output AI_FOUNDRY_RESOURCE_NAME string = resources.outputs.AI_FOUNDRY_RESOURCE_NAME
output CONTENT_UNDERSTANDING_ENDPOINT string = resources.outputs.CONTENT_UNDERSTANDING_ENDPOINT
