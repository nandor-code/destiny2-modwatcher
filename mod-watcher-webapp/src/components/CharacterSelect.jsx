import React from "react";
import { Button, Grid, Card, CardContent } from "@material-ui/core";
import { deepPurple } from "@material-ui/core/colors";
import { makeStyles } from "@material-ui/core/styles";
import { destiny2Classes, destiny2Races, getIconURL } from "../apis/Bungie-API";
import { DateTime } from "luxon";

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  card: {
    padding: theme.spacing(2),
    textAlign: "center",
    color: theme.palette.text.secondary,
    minHeight: "100%",
    minWidth: "100%",
  },
  logo: {
    color: theme.palette.getContrastText(deepPurple[500]),
    backgroundColor: deepPurple[500],
    margin: "auto",
    display: "block",
    maxWidth: "100%",
    maxHeight: "100%",
  },
  griditem: {
    width: "474px",
    height: "96px",
  },
  button: {
    textTransform: "none",
  },
  class: {
    position: "absolute",
    color: "white",
    left: "88px",
    top: "15px",
    zIndex: "4",
    fontSize: 27,
  },
  race: {
    position: "absolute",
    color: "white",
    left: "88px",
    top: "52px",
    zIndex: 4,
    fontSize: 16,
    opacity: 0.6,
  },
  light: {
    position: "absolute",
    right: "12px",
    top: "13px",
    zIndex: 4,
    fontSize: "38px",
    fontWeight: "500",
    fontFamily: "var(--font-text)",
    lineHeight: "34px",
    color: "#e5d163",
    textShadow: "0 2px 1px rgba(0,0,0,.2)",
  },
  lastplayed: {
    position: "absolute",
    right: "12px",
    bottom: "16px",
    zIndex: 4,
    fontSize: "12px",
    fontWeight: "500",
    fontFamily: "var(--font-text)",
    lineHeight: "14px",
    textShadow: "0 2px 1px rgba(0,0,0,.2)",
  },
}));

export const CharacterSelect = (props) => {
  const { characterData, setCharacterId } = props;
  const classes = useStyles();

  const getDateDelta = (dateStr) => {
    return DateTime.fromISO(dateStr).toRelative();
  };

  console.log("chars", characterData);

  return (
    <React.Fragment>
      <div className={classes.root}>
        <Grid container direction="column" justify="center" alignItems="center">
          {Object.entries(characterData.characters.data).map(([id, c], idx) => {
            return (
              <Button
                className={classes.button}
                key={idx}
                onClick={() => setCharacterId(id)}
              >
                <Grid item className={classes.griditem} xs={12}>
                  <Card
                    className={classes.card}
                    style={{
                      backgroundImage: `url(${getIconURL(
                        c.emblemBackgroundPath
                      )})`,
                    }}
                  >
                    <CardContent>
                      <div className={classes.class}>
                        {destiny2Classes[c.classType]}
                      </div>
                      <div className={classes.race}>
                        {destiny2Races[c.classType]}
                      </div>
                      <div className={classes.light}>{c.light}</div>
                      <div className={classes.lastplayed}>
                        {getDateDelta(c.dateLastPlayed)}
                      </div>
                    </CardContent>
                  </Card>
                </Grid>
              </Button>
            );
          })}
        </Grid>
      </div>
    </React.Fragment>
  );
};
