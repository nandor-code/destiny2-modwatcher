import React from "react";
import { Typography, Button, Grid, Paper, Avatar } from "@material-ui/core";
import { deepPurple } from "@material-ui/core/colors";
import { makeStyles } from "@material-ui/core/styles";
import { getIconURL } from "../apis/Bungie-API";

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    alignContent: "center",
    alignItems: "center",
  },
  paper: {
    padding: theme.spacing(2),
    textAlign: "center",
    color: theme.palette.text.secondary,
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
    minWidth: "500px",
  },
  button: {
    textTransform: "none",
  },
}));

export const MembershipSelect = (props) => {
  const { membershipData, setMembershipId } = props;
  const classes = useStyles();

  console.log(membershipData);

  return (
    <React.Fragment>
      <div className={classes.root}>
        <Grid container direction="column" justify="center" alignItems="center">
          {membershipData.destinyMemberships.map((m, idx) => {
            return (
              <Button
                className={classes.button}
                key={idx}
                onClick={() =>
                  setMembershipId(m.membershipId, m.membershipType)
                }
              >
                <Grid item className={classes.griditem} xs={12}>
                  <Paper className={classes.paper}>
                    <Grid container spacing={2}>
                      <Grid item>
                        <Avatar
                          className={classes.logo}
                          alt="logo"
                          src={getIconURL(m.iconPath)}
                        />
                      </Grid>
                      <Grid item>
                        <Typography gutterBottom variant="subtitle1">
                          {m.LastSeenDisplayName}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              </Button>
            );
          })}
        </Grid>
      </div>
    </React.Fragment>
  );
};
