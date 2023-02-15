import React, { useState } from "react";
import {
  Grid,
  Button,
  TextField,
  InputAdornment,
  Typography,
} from "@material-ui/core";
import EmailIcon from "@material-ui/icons/EmailRounded";
import { useStyles } from "./VendorStyles";
import { requestSubscribe } from "../../apis/ModWatcher-API";

export const SubscribePanel = (props) => {
  const { theme, oAuth, membershipType, membershipId, characterId } = props;
  const classes = useStyles(theme);
  const [emailAddr, setEmailAddr] = useState("");
  const [validEmail, setValidEmail] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subscribedText, setSubscribedText] = useState("");

  const handleRequestUpdates = () => {
    console.log(emailAddr, oAuth, membershipType, membershipId, characterId);

    setSubscribedText("Requesting Subscription...");

    requestSubscribe(
      emailAddr,
      oAuth,
      membershipType,
      membershipId,
      characterId
    )
      .then((res) => {
        console.log(res);
        setSubscribed(true);
        setSubscribedText("Subscribed!");
      })
      .catch((err) => {
        console.log("ERROR", err);
        setSubscribedText("Subscription Failed...");
      });
  };

  const updateEmail = (event) => {
    let newEmail = event.target.value;

    if (subscribed) {
      setSubscribed(false);
    }
    if (subscribedText !== "") {
      setSubscribedText("");
    }
    setEmailAddr(newEmail);

    let validEmail = new RegExp(
      /^(("[\w-\s]+")|([\w-+]+(?:\.[\w-]+)*)|("[\w-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i
    );

    if (validEmail.test(newEmail)) {
      console.log("valid");
      setValidEmail(true);
    } else {
      console.log("invalid");
      setValidEmail(false);
    }
  };

  return (
    <React.Fragment>
      <Grid
        className={classes.subpanel}
        container
        direction="row"
        justify="space-evenly"
        alignItems="center"
      >
        <TextField
          error={!validEmail}
          helperText={validEmail ? "" : "Enter a valid email address"}
          id="standard-basic"
          label="Email to Subscribe"
          value={emailAddr}
          onChange={updateEmail}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailIcon />
              </InputAdornment>
            ),
          }}
        />
        <Button
          color="primary"
          variant="contained"
          disabled={!validEmail}
          onClick={() => handleRequestUpdates()}
        >
          Subscribe to Updates
        </Button>
      </Grid>
      {subscribed ? (
        <Typography variant="h6" style={{ color: "lightGreen" }}>
          {subscribedText}
        </Typography>
      ) : (
        <></>
      )}
    </React.Fragment>
  );
};
