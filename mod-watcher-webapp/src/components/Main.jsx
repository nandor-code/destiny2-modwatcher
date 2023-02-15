import React, { useEffect, useState, useMemo } from "react";
import QueryString from "query-string";
import { ThemeProvider } from "@material-ui/styles";
import {
  AppBar,
  CssBaseline,
  Typography,
  createMuiTheme,
  Backdrop,
  CircularProgress,
} from "@material-ui/core";
import { MembershipSelect } from "./MembershipSelect";
import { CharacterSelect } from "./CharacterSelect";
import { VendorPanel } from "./VendorPanel";
import {
  requestAccessToken,
  getAuthURL,
  getMembershipDataForCurrentUser,
  getCharacters,
  getVendors,
  getDestiny2Manifest,
  getDestiny2ManifestContent,
} from "../apis/Bungie-API";
import { makeStyles } from "@material-ui/core/styles";
import { createBrowserHistory } from "history";

const theme = createMuiTheme({
  palette: {
    type: "dark",
  },
});

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
    color: "#fff",
  },
}));

export const Main = (props) => {
  const [oAuth, setOAuth] = useState(null);
  const [oAuthRequested, setOAuthRequested] = useState(false);
  const [membershipData, setMembershipData] = useState(null);
  const [characterData, setCharacterData] = useState(null);
  const [vendorData, setVendorData] = useState(null);
  const [destiny2Manifest, setDestiny2Manifest] = useState(null);
  const [destiny2Vendors, setDestiny2Vendors] = useState(null);
  const [destiny2Items, setDestiny2Items] = useState(null);
  const [selectedMemberShipId, setSelectedMembershipId] = useState(-1);
  const [selectedMemberShipType, setSelectedMembershipType] = useState(-1);
  const [selectedCharacterId, setSelectedCharacterId] = useState(-1);
  const [appBarText, setAppBarText] = useState(
    "Welcome to Destiny Mod Watcher"
  );

  const browserHistory = createBrowserHistory();
  const classes = useStyles();
  const params = QueryString.parse(props.location.search);
  let haveCode = params["code"] || oAuth ? true : false;

  /**
   * @param {...String} queryNames
   */
  const removeQuery = (...queryNames) => {
    let newLocation = browserHistory.location;
    let params = new URLSearchParams(browserHistory.location.search);

    queryNames.forEach((q) => params.delete(q));
    newLocation.search = params.toString();
    console.log("new loc", newLocation);
    browserHistory.push(newLocation);
  };

  const getAuthCode = () => {
    if (oAuthRequested) {
      setOAuthRequested(true);
    }
    window.location.href = getAuthURL();
  };

  const setMembership = (id, type) => {
    setSelectedMembershipId(id);
    setSelectedMembershipType(type);
  };

  useEffect(() => {
    makeAPICall(getDestiny2Manifest, [], setDestiny2Manifest);
  }, []);

  useEffect(() => {
    if (destiny2Manifest) {
      makeAPICall(
        getDestiny2ManifestContent,
        [
          destiny2Manifest.jsonWorldComponentContentPaths.en
            .DestinyVendorDefinition,
        ],
        setDestiny2Vendors
      );

      makeAPICall(
        getDestiny2ManifestContent,
        [
          destiny2Manifest.jsonWorldComponentContentPaths.en
            .DestinyInventoryItemDefinition,
        ],
        setDestiny2Items
      );
    }
  }, [destiny2Manifest]);

  useEffect(() => {
    if (haveCode && !oAuth && !oAuthRequested) {
      makeAPICall(requestAccessToken, [params["code"]], setOAuth, getAuthCode);
      removeQuery("code");
      setOAuthRequested(true);
    }
  }, [oAuth, params, haveCode, oAuthRequested]);

  /* oAuth loaded let's get some data */
  useEffect(() => {
    if (oAuth && oAuth.access_token) {
      makeAPICall(getMembershipDataForCurrentUser, [oAuth], setMembershipData);
    }
  }, [oAuth]);

  useEffect(() => {
    if (selectedMemberShipId !== -1 && selectedMemberShipType !== -1) {
      makeAPICall(
        getCharacters,
        [selectedMemberShipId, selectedMemberShipType],
        setCharacterData
      );
    }
  }, [selectedMemberShipId, selectedMemberShipType]);

  useEffect(() => {
    if (
      selectedMemberShipId !== -1 &&
      selectedMemberShipType !== -1 &&
      selectedCharacterId !== -1
    ) {
      makeAPICall(
        getVendors,
        [
          selectedMemberShipId,
          selectedMemberShipType,
          selectedCharacterId,
          oAuth,
        ],
        setVendorData
      );
    }
  }, [
    selectedMemberShipId,
    selectedMemberShipType,
    selectedCharacterId,
    oAuth,
  ]);

  const makeAPICall = (apiCall, opts, setData, failedFunc = false) => {
    apiCall(...opts)
      .then((res) => {
        console.log("Data from " + apiCall.name, res);
        setData(res.data.Response ? res.data.Response : res.data);
      })
      .catch((err) => {
        console.log("Error in " + apiCall.name, err);

        if (err.response) {
          console.log("Error Reponse", err.response.data);
        }

        if (failedFunc) {
          failedFunc();
        }
      });
  };

  const renderMain = useMemo(() => {
    if (!haveCode) {
      return <React.Fragment>{getAuthCode()}</React.Fragment>;
    }

    // We have auth code let's let them select an account. if needed.
    if (membershipData && selectedMemberShipId === -1) {
      setAppBarText("Select your Account");
      return (
        <MembershipSelect
          membershipData={membershipData}
          setMembershipId={setMembership}
        />
      );
    }

    if (characterData && selectedCharacterId === -1) {
      setAppBarText("Select your Character");

      return (
        <CharacterSelect
          characterData={characterData}
          setCharacterId={setSelectedCharacterId}
        />
      );
    }

    if (vendorData && destiny2Vendors && destiny2Items) {
      setAppBarText("Subscribe to Vendor Updates");
      return (
        <VendorPanel
          theme={theme}
          characterVendors={vendorData}
          items={destiny2Items}
          gameVendors={destiny2Vendors}
          oAuth={oAuth}
          membershipType={selectedMemberShipType}
          membershipId={selectedMemberShipId}
          characterId={selectedCharacterId}
        />
      );
    }

    return (
      <Backdrop className={classes.backdrop} open={true}>
        <CircularProgress color="inherit" />
      </Backdrop>
    );
  }, [
    haveCode,
    membershipData,
    selectedMemberShipId,
    characterData,
    selectedCharacterId,
    classes.backdrop,
    vendorData,
    destiny2Vendors,
    destiny2Items,
    oAuth,
    selectedMemberShipType,
  ]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ marginTop: 50 }}>{renderMain}</div>
      <AppBar color="inherit">
        <Typography variant="h6">{appBarText}</Typography>
      </AppBar>
    </ThemeProvider>
  );
};
