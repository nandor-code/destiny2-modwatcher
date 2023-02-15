import { makeStyles } from "@material-ui/core/styles";

export const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  media: {
    height: 150,
    width: 525,
    justifyContent: "center",
    marginTop: "16px",
  },
  subpanel: {
    maxWidth: "45%",
  },
  icon: {
    height: 64,
    width: 64,
    margin: "16px",
    marginRight: 0,
  },
  itemcard: {
    display: "flex",
    width: 325,
    height: 64 + 32,
    backgroundColor: "#1C1C5C",
  },
  itemcarddisabled: {
    opacity: 0.2,
  },
  details: {
    display: "flex",
    flexDirection: "column",
    width: 325 - 64 - 16,
    margin: "16px",
    marginLeft: 0,
  },
  content: {
    flex: "1 0 auto",
    padding: "0px !important",
    width: "100%",
    height: "100%",
  },
  vendorpanel: {
    paddingTop: "32px",
  },
  vendorname: {
    fontFamily: '"Helvetica", "Arial", sans-serif',
    fontWeight: 600,
  },
  section1: {
    margin: theme.spacing(3, 2),
  },
  section2: {
    margin: theme.spacing(2),
  },
  section3: {
    margin: theme.spacing(3, 1, 1),
  },
  category: {
    backgroundColor: "#4C4C4C",
    margin: "8px",
  },
}));
