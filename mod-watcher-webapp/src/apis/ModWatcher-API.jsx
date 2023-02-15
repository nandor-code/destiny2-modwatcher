const basePath = "https://rs35kii0md.execute-api.us-west-2.amazonaws.com";

var apigClientFactory = require("aws-api-gateway-client").default;

var apiClient = apigClientFactory.newClient({
  invokeUrl: basePath,
  region: "us-west-2",
});

var apiStage = "/prod"; //"/dev"

export async function requestSubscribe(
  email,
  oauth,
  membershipType,
  membershipId,
  characterId
) {
  return apiRequest({
    email: email,
    oauth: oauth,
    membershipType: membershipType,
    membershipId: membershipId,
    characterId: characterId,
  });
}

async function apiRequest(body) {
  return apiClient.invokeApi("", apiStage + "/ModWatcherAPI", "POST", {}, body);
}
