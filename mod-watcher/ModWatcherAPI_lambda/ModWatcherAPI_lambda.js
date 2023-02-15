// Load Mailgun API
const mailgun = require("mailgun-js");
let mg = null;

// Load the AWS SDK
var AWS = require("aws-sdk");

// Create Param Store

const ddb_table = process.env["DDB_TABLE"];
const bungie_api_param = process.env["BUNGIE_API_PARAM"];
const mailgun_api_param = process.env["MAILGUN_API_PARAM"];

const crypto = require("crypto");

const ddb = new AWS.DynamoDB();
const ses = new AWS.SES();
const ssm = new AWS.SSM();

let version = "1.1";
let apiCreds = {};

let gameVendors = "";
let gameItems = "";

let bansheeHash = "672118013";
let adaHash = "350061650";

let allHashes = [bansheeHash, adaHash];

let itemTypeMod = 19;

// Handler
exports.handler = async function (event, context) {
  console.log("## DDB_TABLE NAME: " + serialize(ddb_table));
  console.log("## CONTEXT: " + serialize(context));
  console.log("## EVENT: " + serialize(event));
  console.log("## VERSION: " + serialize(version));

  try {
    apiCreds = await getCredentials(bungie_api_param);
    console.log(apiCreds, typeof apiCreds);

    let mgCreds = await getCredentials(mailgun_api_param);

    if (mgCreds) {
      mg = mailgun(mgCreds);
    }

    if (event && event.httpMethod === "POST") {
      /* request to subscribe */
      let jsonBody = JSON.parse(event.body);

      let refreshToken = await refreshAccessToken(jsonBody.oauth.refresh_token);

      let oauth = refreshToken.data;

      await saveSubscription(
        jsonBody.email,
        jsonBody.membershipId,
        jsonBody.membershipType,
        jsonBody.characterId,
        oauth,
        ""
      );

      console.log("EVENT: Subscibe user: " + jsonBody.email);

      return formatResponse(serialize({ success: true }), "");
    }

    if (
      event &&
      event.httpMethod === "GET" &&
      event.queryStringParameters &&
      event.queryStringParameters.unsubscribe
    ) {
      console.log(
        "EVENT: Unsubscribe user: " + event.queryStringParameters.unsubscribe
      );

      let result = "";
      try {
        await deleteSubscription(event.queryStringParameters.unsubscribe);
      } catch (error) {
        result = error;
      }

      return formatResponse(
        serialize({
          success: result === "" ? true : false,
          event: "unsubscribe",
          result: result,
          user: event.queryStringParameters.unsubscribe,
        }),
        ""
      );
    }

    await loadManifest();

    let subs = await loadSubscriptions();

    let unsubURL =
      "https://rs35kii0md.execute-api.us-west-2.amazonaws.com/prod/ModWatcherAPI?unsubscribe=";

    /* Recurring check of vendors.  */

    for (const sub of subs) {
      await processSub(sub, unsubURL);
    }

    return formatResponse(serialize({ success: true }));
  } catch (error) {
    console.log("ERR", error);
    return formatError(error);
  }
};

async function processSub(sub, unsublink) {
  console.log("DB EMAIL", sub.email.S);
  console.log("DB OAUTH", sub.oauth.S);

  //if (sub.email.S !== "nandor@ntsj.com") {
  //console.log("test bail");
  //return;
  //}

  let refreshToken = "";

  refreshToken = await refreshAccessToken(
    JSON.parse(sub.oauth.S).refresh_token
  );

  let oauth = refreshToken.data;

  console.log("NEW OAUTH", oauth);

  let emailBody = emailTemplate;
  let vendorTable = "";

  let itemCount = 0;

  for (const curHash of allHashes) {
    /* only need 1 Banshee let's be real. */
    let vendorResult = await getVendor(
      sub.membershipId.S,
      sub.membershipType.S,
      sub.characterId.S,
      curHash,
      oauth
    );

    let items = "";
    let vendorEmail = vendorTemplate;

    /* Recurring check of vendors.  */
    let characterVendor = vendorResult.data.Response;

    let gameVendor = gameVendors[curHash];

    let salesDataMap = Object.values(characterVendor.sales.data);

    for (let characterVendorItem of salesDataMap) {
      let vendorItem = gameVendor.itemList.find(
        (cur) => cur.itemHash === characterVendorItem.itemHash
      );
      let gameItem = gameItems[characterVendorItem.itemHash];

      if (vendorItem.displayCategory !== "Material Exchange") {
        continue;
      }

      if (gameItem.itemType !== itemTypeMod) {
        continue;
      }

      let item = itemTemplate;

      item = item.replace(
        new RegExp("%ITEMNAME%", "g"),
        gameItem.displayProperties.name
      );

      item = item.replace(
        "%ITEMICON%",
        getIconURL(gameItem.displayProperties.icon)
      );

      item = item.replace(
        "%ITEMDISABLED%",
        characterVendorItem.saleStatus !== 0 ? "opacity: 0.2;" : "opacity: 1.0;"
      );

      if (characterVendorItem.saleStatus === 0) {
        itemCount += 1;
      }

      console.log(
        "ITEM",
        gameItem.displayProperties.name,
        "STATUS",
        characterVendorItem.saleStatus
      );

      items += item;
    }

    vendorEmail = vendorEmail.replace(
      new RegExp("%VENDORNAME%", "g"),
      gameVendor.displayProperties.name
    );
    vendorEmail = vendorEmail.replace(
      "%VENDORIMG%",
      getIconURL(gameVendor.displayProperties.largeIcon)
    );

    vendorEmail = vendorEmail.replace("%ITEMLIST%", items);

    vendorTable += vendorEmail;
  }

  emailBody = emailBody.replace("%VENDORS%", vendorTable);

  let unsubURL = unsublink + encodeURIComponent(sub.email.S);

  emailBody = emailBody.replace("%UNSUB%", unsubURL);

  var md5sum = crypto.createHash("md5");
  md5sum.update(JSON.stringify(emailBody));
  let emailHash = md5sum.digest("hex").toString();

  if (emailHash !== sub.lastEmailHash.S) {
    sendMGEmail(
      sub.email.S,
      "ModWatcher: " + itemCount + " New Mods Available!",
      emailBody
    );

    console.log("MD5:", emailHash);

    await saveSubscription(
      sub.email.S,
      sub.membershipId.S,
      sub.membershipType.S,
      sub.characterId.S,
      oauth,
      emailHash
    );
  } else {
    console.log(
      "Skipping email to " +
        sub.email.S +
        " because we already sent this same email."
    );
  }
}

async function saveSubscription(
  email,
  membershipId,
  membershipType,
  characterId,
  oauth,
  lastEmailHash
) {
  var params = {
    TableName: ddb_table,
    Item: {
      email: { S: email },
      characterId: { S: characterId },
      membershipId: { S: membershipId },
      membershipType: { S: membershipType.toString() },
      oauth: { S: JSON.stringify(oauth) },
      lastEmailHash: { S: lastEmailHash.toString() },
    },
  };

  console.log("SUB", params);

  // Call DynamoDB to add the item to the table
  return ddb.putItem(params).promise();
}

async function deleteSubscription(email) {
  var params = {
    TableName: ddb_table,
    Key: {
      email: { S: email },
    },
  };

  console.log("UNSUB", params);

  // Call DynamoDB to add the item to the table
  return ddb.deleteItem(params, () => {}).promise();
}

async function loadSubscriptions() {
  var params = {
    TableName: ddb_table,
  };

  console.log("RUNNING QUERY");

  // Call DynamoDB to read the item from the table
  let ddbRes = await ddb.scan(params).promise();

  console.log("LOADED SUBS:", JSON.stringify(ddbRes));

  return ddbRes.Items;
}

function sendEmail(address, subject, data) {
  var params = {
    Destination: {
      ToAddresses: [address],
    },
    Message: {
      Body: {
        Html: { Data: data },
      },

      Subject: { Data: subject },
    },
    Source: "Destiny2 - ModWatcher <modwatcher@ntsj.com>",
  };

  return ses.sendEmail(params).promise();
}

async function sendMGEmail(address, subject, data) {
  const email = {
    from: "Destiny2 - ModWatcher <modwatcher@ntsj.com>",
    to: address,
    subject: subject,
    html: data,
  };

  let result = "";
  try {
    result = await mg.messages().send(email);
  } catch (e) {
    console.log("MAIL ERROR", e);
    result = JSON.stringify(e);
  }

  return result;
}

async function loadManifest() {
  let maniRes = await getDestiny2Manifest();
  let maniJson = maniRes.data.Response;

  let gameVendorsRes = await getDestiny2ManifestContent(
    maniJson.jsonWorldComponentContentPaths.en.DestinyVendorDefinition
  );

  let gameItemsRes = await getDestiny2ManifestContent(
    maniJson.jsonWorldComponentContentPaths.en.DestinyInventoryItemDefinition
  );

  gameItems = gameItemsRes.data;
  gameVendors = gameVendorsRes.data;

  console.log("VENDORS LOADED:", Object.entries(gameVendors).length);
  console.log("ITEMS LOADED:", Object.entries(gameItems).length);
}

var formatResponse = function (body, event) {
  var response = {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "API-Version": version,
    },
    isBase64Encoded: false,
    body: JSON.stringify({ event: event, body: body }),
  };
  return response;
};

var formatRedirect = function (uri) {
  var response = {
    statusCode: 301,
    headers: {
      Location: uri,
    },
  };
  return response;
};

var formatError = function (error) {
  var response = {
    statusCode: error.statusCode,
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*",
      "API-Version": version,
      "x-amzn-ErrorType": error.code,
    },
    isBase64Encoded: false,
    body: JSON.stringify({ success: false, error: JSON.stringify(error) }),
  };
  return response;
};
// Use SDK client
var serialize = function (object) {
  return JSON.stringify(object, null, 2);
};

async function getCredentials(paramName) {
  //console.log("Loading Param:", paramName);
  var param = await ssm.getParameter({ Name: paramName }).promise();
  var jsonValue = JSON.parse(param.Parameter.Value);
  //console.log("param", jsonValue, typeof jsonValue);
  return jsonValue;
}

/* Bungie API */
const QueryString = require("querystring");
const axios = require("axios");

const membershipIdToDisplayName = {
  0: "None",
  1: "XBoX",
  2: "PlayStation",
  3: "Steam",
  4: "Blizzard",
  5: "Stadia",
  10: "Demon",
  254: "BungieNext",
};

const destiny2Classes = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock",
  3: "Unknown",
};

const destiny2Races = {
  0: "Human",
  1: "Awoken",
  2: "Exo",
  3: "Unknown",
};

const main_endpoints = {
  rootPath: "https://www.bungie.net/Platform",
  basePath: "https://www.bungie.net/",
  imgPath: "https://www.bungie.net/",
  authorization: "https://www.bungie.net/en/OAuth/Authorize",
  token: "/App/OAuth/token/",
  refresh: "/App/OAuth/token/",
  getCommonSettings: "/Settings/",
  getGlobalAlerts: "/GlobalAlerts/",
  getAvailableLocales: "/GetAvailableLocales/",
  getApplicationApiUsage: "/App/ApiUsage/{applicationId}/",
  getBungieApplications: "/App/FirstParty/",
};

const user_endpoints = {
  getBungieNetUserById: "/User/GetBungieNetUserById/{id}/",
  searchUsers: "/User/SearchUsers/",
  getAvailableThemes: "/User/GetAvailableThemes/",
  getMembershipDataById:
    "/User/GetMembershipsById/{membershipId}/{membershipType}/",
  getMembershipDataForCurrentUser: "/User/GetMembershipsForCurrentUser/",
  getPartnerships: "/User/{membershipId}/Partnerships/",
};

/** An object containing all of the Destiny 2 endpoints */
const d2_endpoints = {
  /** Returns the current version of the manifest as a json object. */
  getDestinyManifest: "/Destiny2/Manifest/",
  /** Returns the static definition of an entity of the given Type and hash identifier. Examine the API Documentation for the Type Names of entities that have their own definitions. Note that the return type will always *inherit from* DestinyDefinition, but the specific type returned will be the requested entity type if it can be found. Please don't use this as a chatty alternative to the Manifest database if you require large sets of data, but for simple and one-off accesses this should be handy. */
  getDestinyEntityDefinition:
    "/Destiny2/Manifest/{entityType}/{hashIdentifier}/",
  /** Returns a list of Destiny memberships given a full Gamertag or PSN ID. */
  searchDestinyPlayer:
    "/Destiny2/SearchDestinyPlayer/{membershipType}/{displayName}/",
  /** Returns a summary information about all profiles linked to the requesting membership type/membership ID that have valid Destiny information. The passed-in Membership Type/Membership ID may be a Bungie.Net membership or a Destiny membership. It only returns the minimal amount of data to begin making more substantive requests, but will hopefully serve as a useful alternative to UserServices for people who just care about Destiny data. Note that it will only return linked accounts whose linkages you are allowed to view. */
  getLinkedProfiles:
    "/Destiny2/{membershipType}/Profile/{membershipId}/LinkedProfiles/",
  /** Returns Destiny Profile information for the supplied membership. */
  getProfile: "/Destiny2/{membershipType}/Profile/{destinyMembershipId}/",
  /** Returns character information for the supplied character. */
  getCharacter:
    "/Destiny2/{membershipType}/Profile/{destinyMembershipId}/Character/{characterId}/",
  /** Returns information on the weekly clan rewards and if the clan has earned them or not. Note that this will always report rewards as not redeemed. */
  getClanWeeklyRewardState: "/Destiny2/Clan/{groupId}/WeeklyRewardState/",
  /** Retrieve the details of an instanced Destiny Item. An instanced Destiny item is one with an ItemInstanceId. Non-instanced items, such as materials, have no useful instance-specific details and thus are not queryable here. */
  getItem:
    "/Destiny2/{membershipType}/Profile/{destinyMembershipId}/Item/{itemInstanceId}/",
  /** Get currently available vendors from the list of vendors that can possibly have rotating inventory. Note that this does not include things like preview vendors and vendors-as-kiosks, neither of whom have rotating/dynamic inventories. Use their definitions as-is for those. */
  getVendors:
    "/Destiny2/{membershipType}/Profile/{destinyMembershipId}/Character/{characterId}/Vendors/",
  /** Get the details of a specific Vendor. */
  getVendor:
    "/Destiny2/{membershipType}/Profile/{destinyMembershipId}/Character/{characterId}/Vendors/{vendorHash}/",
  /** Given a Presentation Node that has Collectibles as direct descendants, this will return item details about those descendants in the context of the requesting character. */
  getCollectibleNodeDetails:
    "/Destiny2/{membershipType}/Profile/{destinyMembershipId}/Character/{characterId}/Collectibles/{collectiblePresentationNodeHash}/",
  /** Transfer an item to/from your vault. You must have a valid Destiny account. You must also pass BOTH a reference AND an instance ID if it's an instanced item. itshappening.gif */
  gransferItem: "/Destiny2/Actions/Items/TransferItem/",
  /** Extract an item from the Postmaster, with whatever implications that may entail. You must have a valid Destiny account. You must also pass BOTH a reference AND an instance ID if it's an instanced item.*/
  pullFromPostmaster: "/Destiny2/Actions/Items/PullFromPostmaster/",
  /** Equip an item. You must have a valid Destiny Account, and either be in a social space, in orbit, or offline. */
  equipItem: "/Destiny2/Actions/Items/EquipItem/",
  /** Equip a list of items by itemInstanceIds. You must have a valid Destiny Account, and either be in a social space, in orbit, or offline. Any items not found on your character will be ignored. */
  equipItems: "/Destiny2/Actions/Items/EquipItems/",
  /** Set the Lock State for an instanced item. You must have a valid Destiny Account. */
  setItemLockState: "/Destiny2/Actions/Items/SetLockState/",
  /** Insert a plug into a socketed item. I know how it sounds, but I assure you it's much more G-rated than you might be guessing. We haven't decided yet whether this will be able to insert plugs that have side effects, but if we do it will require special scope permission for an application attempting to do so. You must have a valid Destiny Account, and either be in a social space, in orbit, or offline. Request must include proof of permission for 'InsertPlugs' from the account owner. */
  insertSocketPlug: "/Destiny2/Actions/Items/InsertSocketPlug/",
  /** Gets the available post game carnage report for the activity ID. */
  getPostGameCarnageReport:
    "/Destiny2/Stats/PostGameCarnageReport/{activityId}/",
  /** Report a player that you met in an activity that was engaging in ToS-violating activities. Both you and the offending player must have played in the activityId passed in. Please use this judiciously and only when you have strong suspicions of violation, pretty please. */
  reportOffensivePostGameCarnageReportPlayer:
    "/Destiny2/Stats/PostGameCarnageReport/{activityId}/Report/",
  /** Gets historical stats definitions. */
  getHistoricalStatsDefinition: "/Destiny2/Stats/Definition/",
  /** Gets leaderboards with the signed in user's friends and the supplied destinyMembershipId as the focus. PREVIEW: This endpoint is still in beta, and may experience rough edges. The schema is in final form, but there may be bugs that prevent desirable operation. */
  getClanLeaderboards: "/Destiny2/Stats/Leaderboards/Clans/{groupId}/",
  /** Gets aggregated stats for a clan using the same categories as the clan leaderboards. PREVIEW: This endpoint is still in beta, and may experience rough edges. The schema is in final form, but there may be bugs that prevent desirable operation. */
  getClanAggregateStats: "/Destiny2/Stats/AggregateClanStats/{groupId}/",
  /** Gets leaderboards with the signed in user's friends and the supplied destinyMembershipId as the focus. PREVIEW: This endpoint has not yet been implemented. It is being returned for a preview of future functionality, and for public comment/suggestion/preparation. */
  getLeaderboards:
    "/Destiny2/{membershipType}/Account/{destinyMembershipId}/Stats/Leaderboards/",
  /** Gets leaderboards with the signed in user's friends and the supplied destinyMembershipId as the focus. PREVIEW: This endpoint is still in beta, and may experience rough edges. The schema is in final form, but there may be bugs that prevent desirable operation. */
  getLeaderboardsForCharacter:
    "/Destiny2/Stats/Leaderboards/{membershipType}/{destinyMembershipId}/{characterId}/",
  /** Gets a page list of Destiny items. */
  searchDestinyEntities: "/Destiny2/Armory/Search/{type}/{searchTerm}/",
  /** Gets historical stats for indicated character. */
  getHistoricalStats:
    "/Destiny2/{membershipType}/Account/{destinyMembershipId}/Character/{characterId}/Stats/",
  /** Gets aggregate historical stats organized around each character for a given account. */
  getHistoricalStatsForAccount:
    "/Destiny2/{membershipType}/Account/{destinyMembershipId}/Stats/",
  /** Gets activity history stats for indicated character. */
  getActivityHistory:
    "/Destiny2/{membershipType}/Account/{destinyMembershipId}/Character/{characterId}/Stats/Activities/",
  /** Gets details about unique weapon usage, including all exotic weapons. */
  getUniqueWeaponHistory:
    "/Destiny2/{membershipType}/Account/{destinyMembershipId}/Character/{characterId}/Stats/UniqueWeapons/",
  /** Gets all activities the character has participated in together with aggregate statistics for those activities. */
  getDestinyAggregateActivityStats:
    "/Destiny2/{membershipType}/Account/{destinyMembershipId}/Character/{characterId}/Stats/AggregateActivityStats/",
  /** Gets custom localized content for the milestone of the given hash, if it exists. */
  getPublicMilestoneContent: "/Destiny2/Milestones/{milestoneHash}/Content/",
  /** Gets public information about currently available Milestones. */
  getPublicMilestones: "/Destiny2/Milestones/",
  /** Initialize a request to perform an advanced write action. */
  awaInitializeRequest: "/Destiny2/Awa/Initialize/",
  /** Provide the result of the user interaction. Called by the Bungie Destiny App to approve or reject a request. */
  awaProvideAuthorizationResult: "/Destiny2/Awa/AwaProvideAuthorizationResult/",
  /** Returns the action token if user approves the request.*/
  awaGetActionToken: "/Destiny2/Awa/GetActionToken/{correlationId}/",
};

const getIconURL = (path) => {
  return main_endpoints.imgPath + path;
};

const getAuthURL = () => {
  return (
    main_endpoints.authorization +
    "?response_type=code&client_id=" +
    apiCreds.clientId
  );
};

const requestAccessToken = (authCode) => {
  return makeBungieAPIPost(
    main_endpoints.rootPath + main_endpoints.token,
    QueryString.stringify({
      grant_type: "authorization_code",
      code: authCode,
      client_id: apiCreds.clientId,
    })
  );
};

async function refreshAccessToken(refresh_token) {
  return makeBungieAPIPost(
    main_endpoints.rootPath + main_endpoints.refresh,
    QueryString.stringify({
      grant_type: "refresh_token",
      refresh_token: refresh_token,
      client_id: apiCreds.clientId,
    })
  );
}

const getMembershipDataForCurrentUser = (oAuth) => {
  return makeBungieAPIGet(
    main_endpoints.rootPath + user_endpoints.getMembershipDataForCurrentUser,
    oAuth
  );
};

const getDestiny2Manifest = () => {
  return makeBungieAPIGet(
    main_endpoints.rootPath + d2_endpoints.getDestinyManifest
  );
};

const getDestiny2ManifestContent = (contentPath) => {
  // hacky hack is hacky

  let url = main_endpoints.basePath + contentPath + "?definitions=true";

  return makeBungieAPIGet(url);
};

const getCharacters = (membershipId, membershipType) => {
  return getProfile(membershipId, membershipType, ["characters"]);
};

const getVendors = (membershipId, membershipType, characterId, oAuth) => {
  let url = createEndpointURL(
    main_endpoints.rootPath + d2_endpoints.getVendors,
    {
      membershipType: membershipType,
      destinyMembershipId: membershipId,
      characterId: characterId,
    },
    {
      components: ["vendors", "vendorcategories", "vendorsales"],
      definitions: ["true"],
    }
  );

  return makeBungieAPIGet(url, oAuth);
};

const getVendor = (
  membershipId,
  membershipType,
  characterId,
  vendorHash,
  oAuth
) => {
  let url = createEndpointURL(
    main_endpoints.rootPath + d2_endpoints.getVendor,
    {
      membershipType: membershipType,
      destinyMembershipId: membershipId,
      characterId: characterId,
      vendorHash: vendorHash,
    },
    {
      components: ["vendors", "vendorcategories", "vendorsales"],
      definitions: ["true"],
    }
  );

  return makeBungieAPIGet(url, oAuth);
};

const getProfile = (
  membershipId,
  membershipType,
  components = ["profiles"]
) => {
  let url = createEndpointURL(
    main_endpoints.rootPath + d2_endpoints.getProfile,
    { membershipType: membershipType, destinyMembershipId: membershipId },
    { components: components }
  );

  //console.log("URL", url);

  return makeBungieAPIGet(url);
};

const createEndpointURL = (url, pathParams, queryStrings) => {
  let output = url;

  Object.keys(pathParams).forEach((k) => {
    if (typeof pathParams[k] == "undefined" || pathParams[k] === "") {
      return;
    }

    let search = RegExp("{" + k + "}", "g");
    output = output.replace(search, pathParams[k]);
  });

  if (typeof queryStrings == "object")
    output += "?" + QueryString.stringify(queryStrings);

  return encodeURI(output);
};

const makeBungieAPIPost = (url, postData, oAuth = false) => {
  let options = {
    headers: {
      "X-API-KEY": apiCreds.key,
      Authorization: oAuth
        ? "Bearer " + oAuth.access_token // Use the oAuth token to
        : "Basic " +
          new Buffer.from(
            apiCreds.clientId + ":" + apiCreds.clientSecret
          ).toString("base64"),
    },
  };

  if (typeof postData === "object") {
    options.headers["Content-Type"] = "application/json";
  } else {
    options.headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  //console.log(options, postData);

  return axios.post(url, postData, options);
};

const makeBungieAPIGet = (url, oAuth = false) => {
  let options = {
    headers: {
      "X-API-KEY": apiCreds.key,
      Authorization: oAuth
        ? "Bearer " + oAuth.access_token // Use the oAuth token to
        : "Basic " +
          new Buffer.from(
            apiCreds.clientId + ":" + apiCreds.clientSecret
          ).toString("base64"),
    },
  };

  //console.log(options);

  return axios.get(url, options);
};

/* Email Templates */
const emailTemplate = `
<div style="padding: 24px; background-color: #424242">
  <table border="0" cellspacing="0" style="margin-left: auto; margin-right: auto; color: #fff; transition: box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms; background-color: #424242; letter-spacing: 0.01071em; background-color: #303030; text-align: center;">
  %VENDORS%
    <tr>
		  <td><a target="_blank" style="cursor: pointer; outline: none; display: inline; text-decoration: none; transition: color 100ms ease 0s; outline-offset: 2px; font-weight: 400; font-size: 16px; line-height: 24px; margin: 0px; color: rgb(7, 115, 152) !important;" href="%UNSUB%">Unsubscribe</a></td>
	  </tr>
  </table> 
</div>
`;

const vendorTemplate = `
  <tr>
      <td style="padding: 12px;">
        <img style="width: 525px;	height: 150px; margin-top: 16px; justify-content: center;" src="%VENDORIMG%" alt="%VENDORNAME%" />
      </td>
	</tr>
	<tr>
      <td style="margin: 24px 16px; height: 40px;">
        %VENDORNAME%
      </td>
  </tr>
  <tr style="width: calc(100% + 24px); margin: -12px; display: flex; flex-wrap: wrap; box-sizing: border-box; justify-content: center;">
      %ITEMLIST%
  </tr>
`;

const itemTemplate = `
    <tr style="padding: 12px; margin: 16px; box-sizing: border-box; display: flex; background-color: #1C1C5C; border-radius: 4px; %ITEMDISABLED%">
			<td>
				<img style="width: 64px; height: 64px; margin-right: 0;" src="%ITEMICON%" alt="%ITEMNAME%" />
			</td>
			<td style="text-align: center;	width: 100%;">%ITEMNAME%</td>
		</tr>
`;
