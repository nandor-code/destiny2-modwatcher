import React from "react";
import {
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
} from "@material-ui/core";
import { getIconURL } from "../../apis/Bungie-API";

export const VendorItem = (props) => {
  const { gameItem, characterVendorItem, classes } = props;

  return (
    <Grid item key={gameItem.itemHash}>
      <Card
        className={
          classes.itemcard +
          " " +
          (characterVendorItem.saleStatus !== 0 ? classes.itemcarddisabled : "")
        }
      >
        <CardMedia
          className={classes.icon}
          image={getIconURL(gameItem.displayProperties.icon)}
          title="Vendor Image"
        />
        <div className={classes.details}>
          <CardContent className={classes.content}>
            <Typography variant="subtitle1">
              {gameItem.displayProperties.name}
            </Typography>
            <Typography variant="subtitle2" color="textSecondary">
              {gameItem.itemTypeDisplayName}
            </Typography>
          </CardContent>
        </div>
      </Card>
    </Grid>
  );
};
