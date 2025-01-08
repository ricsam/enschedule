import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { ReadOnlyEditor } from "~/components/Editor";
import type { DefinitionRowData } from "./DefinitionTypes";

export default function DefinitionPage({
  definition,
}: {
  definition: DefinitionRowData;
}) {
  return (
    <Box id="DefinitionPage">
      <Box>
        <Typography variant="subtitle1" color="text.secondary">
          Every schedule can create runs against this function with data according
          to the following schema. To modify this function you have to ask a
          site administrator to edit the code for this function on the server.
        </Typography>
      </Box>
      <Box pt={3}></Box>
      <Box display="flex">
        {definition.codeBlock ? (
          <>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="h6" component="div">
                  Schema
                </Typography>
                <Box pt={1}></Box>
                <ReadOnlyEditor
                  lang="typescript"
                  example={definition.codeBlock}
                ></ReadOnlyEditor>
              </CardContent>
              <CardActions>
                <Button size="small">Copy</Button>
              </CardActions>
            </Card>
            {definition.example ? <Box pr={3}></Box> : null}
          </>
        ) : null}
        {definition.example ? (
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6" component="div">
                Example
              </Typography>
              <Box pt={1}></Box>
              <ReadOnlyEditor
                lang="json"
                example={JSON.stringify(definition.example, null, 2)}
              ></ReadOnlyEditor>
            </CardContent>
            <CardActions>
              <Button size="small">Copy</Button>
            </CardActions>
          </Card>
        ) : null}
      </Box>
    </Box>
  );
}
