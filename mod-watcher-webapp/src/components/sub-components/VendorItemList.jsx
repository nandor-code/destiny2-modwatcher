import React from "react";
import { Grid, ListSubheader } from "@material-ui/core";
import { VendorItem } from "./VendorItem";

const itemTypeMod = 19;

export const VendorItemList = (props) => {
  const { gameVendorData, characterVendorData, items, classes } = props;

  console.log("gameVendorData", gameVendorData);

  const itemCategories =
    /*gameVendorData.itemList.reduce((acc, curCat) => {
    return acc.indexOf(curCat.displayCategory) === -1
      ? acc.concat(curCat.displayCategory)
      : acc;
  }, []);*/

    ["Material Exchange"];

  console.log("itemCategories", itemCategories);

  return (
    <React.Fragment>
      {itemCategories.map((category, idx) => {
        let catItems = Object.entries(characterVendorData.saleItems).filter(
          ([k, characterVendorItem]) => {
            let vendorItem = gameVendorData.itemList.find(
              (curItem) => curItem.itemHash === characterVendorItem.itemHash
            );
            return vendorItem.displayCategory === category;
          }
        );

        return catItems.length === 0 ? (
          <></>
        ) : (
          <div key={idx}>
            <ListSubheader
              className={classes.category}
              component="div"
              key={"lsh-" + idx}
            >
              {/*<Typography variant="h6" component="h6">
                {category === "" ? "Misc" : category}
              </Typography>*/}
            </ListSubheader>
            <Grid container justify="center" spacing={3} key={"grid-" + idx}>
              {Object.entries(characterVendorData.saleItems).map(
                ([ki, characterVendorItem]) => {
                  let gameItem = items[characterVendorItem.itemHash];
                  let vendorItem = gameVendorData.itemList.find(
                    (cur) => cur.itemHash === characterVendorItem.itemHash
                  );

                  if (gameItem.itemType !== itemTypeMod) {
                    return <div key={ki}></div>;
                  }

                  if (vendorItem.displayCategory !== category) {
                    return <div key={ki}></div>;
                  }

                  console.log("gameItem", idx, ki, gameItem);
                  console.log("characterVendorItem", characterVendorItem);
                  console.log("vendorItem", vendorItem);

                  return (
                    <VendorItem
                      key={ki}
                      classes={classes}
                      gameItem={gameItem}
                      vendorItem={vendorItem}
                      characterVendorItem={characterVendorItem}
                    />
                  );
                }
              )}
            </Grid>
          </div>
        );
      })}
    </React.Fragment>
  );
};
