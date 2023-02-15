import React from "react";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Divider,
} from "@material-ui/core";
import { getIconURL } from "../apis/Bungie-API";
import { VendorItemList } from "./sub-components/VendorItemList";
import { SubscribePanel } from "./sub-components/SubscribePanel";
import { useStyles } from "./sub-components/VendorStyles";

export const VendorPanel = (props) => {
  const {
    characterVendors,
    gameVendors,
    items,
    theme,
    oAuth,
    membershipType,
    membershipId,
    characterId,
  } = props;
  const classes = useStyles(theme);

  console.log("characterVendors", characterVendors);
  console.log("items", items);

  return (
    <React.Fragment>
      <Grid container direction="column" justify="center" alignItems="center">
        <SubscribePanel
          oAuth={oAuth}
          membershipType={membershipType}
          membershipId={membershipId}
          characterId={characterId}
        />
        {Object.entries(characterVendors.sales.data).map(
          ([vendorHash, characterVendorData]) => {
            if (vendorHash !== "672118013") {
              return <div key={vendorHash}></div>;
            }
            let gameVendorData = gameVendors[vendorHash];
            console.log(
              "vendor id",
              vendorHash,
              "vendor data",
              gameVendorData,
              "vendor",
              characterVendorData
            );
            return (
              <Grid
                variant="outlined"
                xs={10}
                className={classes.vendorpanel}
                item
                key={vendorHash}
              >
                <Card className={classes.root} key={vendorHash}>
                  <Typography
                    className={classes.vendorname}
                    variant="h6"
                    component="h6"
                  >
                    Sample Email
                  </Typography>
                  <img
                    className={classes.media}
                    src={getIconURL(gameVendorData.displayProperties.largeIcon)}
                    alt={gameVendorData.displayProperties.name}
                  />
                  <CardContent className={classes.content}>
                    <div className={classes.section1}>
                      <Typography
                        className={classes.vendorname}
                        variant="h4"
                        component="h4"
                      >
                        {gameVendorData.displayProperties.name}
                      </Typography>
                    </div>
                    <Divider variant="middle" />
                    <div className={classes.section2}>
                      <VendorItemList
                        key={vendorHash}
                        classes={classes}
                        gameVendorData={gameVendorData}
                        characterVendorData={characterVendorData}
                        items={items}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Grid>
            );
          }
        )}
      </Grid>
    </React.Fragment>
  );
};
