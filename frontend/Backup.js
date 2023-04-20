import React, { useState, useEffect } from "react";
import {
  useBase,
  Input,
  Box,
  Text,
  Button,
  initializeBlock,
  useGlobalConfig,
  TablePickerSynced,
  ViewPickerSynced,
  FieldPickerSynced,
} from "@airtable/blocks/ui";
import {} from "./functions";
import "./styles.css";
import { ExtensionStateProvider, useExtensionState } from "./states";

const ChatGPTExtension = () => {
  const base = useBase();
  const globalConfig = useGlobalConfig();
  const {
    apiKey,
    setApiKey,
    showApiKey,
    setShowApiKey,
    isApiEntered,
    setIsApiEntered,
    isHelpVisible,
    setIsHelpVisible,
    disableFields,
    setDisableFields,
    chatGptApiKey,
    setChatGptApiKey,
    inputText,
    setInputText,
    response,
    setResponse,
  } = useExtensionState();
  const config = require("./config.json");


  const inputTable = base.getTableByIdIfExists(inputTableId);
  const inputTableId = globalConfig.get("inputTable");
  const inputFieldId = globalConfig.get("inputField");
  const checkmarkFieldId = globalConfig.get("checkmarkField");
  const outputFieldId = globalConfig.get("outputField");

  const gptURL = config.gptURL;
  const tableMateURL = config.tableMateURL;

  const inputField = inputTable
    ? inputTable.getFieldByIdIfExists(inputFieldId)
    : null;
  const checkmarkField = inputTable
    ? inputTable.getFieldByIdIfExists(checkmarkFieldId)
    : null;
  const outputField = inputTable
    ? inputTable.getFieldByIdIfExists(outputFieldId)
    : null;

  //States
  const [tableMateKeyVerified, setTableMateKeyVerified] = useState(false);
  const [gptKeyVerified, setGptKeyVerified] = useState(false);
  const [planVerified, setPlanVerified] = useState(false);


  //Check Tablemate Key
  useEffect(() => {
    const setUpStates = async () => {
      try {
        const tableMateKey = localStorage.getItem("tableMateKey") || "";
        const gptKey = localStorage.getItem("gptKey") || "";

        // Check if there is no ChatGPT key in sessionStorage and if there's a TableMate API key in localStorage
        if (tableMateKey) {
          //make a call to tablemate server to verify the TableMate key
          const tableMateEndpoint = constructUrl(
            tableMateURL,
            "getmember",
            {
              memberID: tableMateKey
            }
          );
          const response = await fetchData(
            tableMateEndpoint,
            tableMateKey,
            ""
          );
          // If tableMateKey is verified
          setTableMateKeyVerified(!!response.data.member);
          // If plan is verified
          setPlanVerified(response.data.member?.plan ? true : false);

          // Fetch GPT key
          if (gptKey) {
            // Call to chatGPT server to verify GPT key
            const gptData = await fetchData(gptURL, gptKey);
            setGptKeyVerified(gptData.ok);
          } else if (response.data.member?.gptkey) {
            // If GPT key is retrieved
            //set local storage to response.data.member.gptkey
            localStorage.setItem("gptKey", response.data.member.gptkey);
            // Call to chatGPT server to verify GPT key
            const gptData = await fetchData(
              gptURL,
              "",
              response.data.member.gptkey
            );
            //if gptKey is verified
            setGptKeyVerified(gptData.ok);
          } else {
            // If GPT key is not retrieved
            setGptKeyVerified(false);
          }
        } else {
          // If there is no TableMate API key in localStorage
          setTableMateKeyVerified(false);
          setGptKeyVerified(false);
          setPlanVerified(false);
        }
      } catch (error) {
        console.error(error);
      }
    };
    setUpStates();
  }, []);

  const constructUrl = (baseUrl, functionPath, queryParams = {}) => {
    // Create an array of query parameter strings by mapping over the keys and values in the queryParams object
    const queryParamStrings = Object.keys(queryParams).map((key) => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(
        queryParams[key]
      )}`;
    });
    // Join the query parameter strings with "&" to create a single query parameter string
    const queryString = queryParamStrings.join("&");
    // Combine the base URL, serverless function path, and query parameter string to create the fully formatted URL
    const url = `${baseUrl}${functionPath}${
      queryString ? `?${queryString}` : ""
    }`;
    return url;
  };

  const fetchData = async (url, token, data) => {
    // Call API to verify token
    return await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  };

  const countRecords = async (recordCount) => {
    //specify the serverless function to add
    //add the record parameter to the tableMate URL
    //format the URl with the tablemate URL
    //send the record count to the server using fetchData
  };

  const toggleApiKeyVisibility = () => {
    setShowApiKey(!showApiKey);
  };

  const handleInputTextChange = (event) => {
    setInputText(event.target.value);
  };

  return (
    <>
      <style>
        {`
        .secondary {
          // background-color: #f2f2f2; /* Change to your desired background color */
          border: 1px solid #d9d9d9; /* Add border to the button */
        }
        .secondary:hover {
          background-color: #e6e6e6; /* Change to your desired hover background color */
        }
      `}
      </style>

      <Box padding={3}>
        <Box marginBottom={3}>
          <Button
            icon={isHelpVisible ? "up" : "down"}
            aria-label="Toggle help text"
            size="small"
            variant="secondary"
            className="secondary"
            onClick={() => setIsHelpVisible(!isHelpVisible)}
          >
            {isHelpVisible && "Hide Instructions"}
            {!isHelpVisible && "Show Instructions"}
          </Button>
        </Box>

        <Box
          marginBottom={3}
          border="1px solid #d9d9d9;"
          borderRadius={5}
          padding={3}
        >
          <Text fontWeight="bold" marginBottom={1}>
            Connect TableMate
          </Text>
          <Box display="flex" alignItems="center">
            {!showApiKey && (
              <>
                <Input
                  value={apiKey}
                  onChange={boundHandleApiKeyChange}
                  placeholder="Enter your API key"
                />
                <Button
                  onClick={boundHandleApiKeySubmit}
                  variant="primary"
                  marginLeft={2}
                >
                  Submit
                </Button>
              </>
            )}

            {showApiKey && (
              <Text
                style={{ color: "green" }}
                marginTop={2}
                marginBottom={1}
                marginRight={2}
              >
                You're connected to TableMate
              </Text>
            )}

            {!disableFields && (
              <Button
                display="inline"
                variant="secondary"
                onClick={toggleApiKeyVisibility}
                className="secondary"
              >
                {showApiKey ? "View API Key" : "Hide API Key"}
              </Button>
            )}
          </Box>
          {!showApiKey && (
            <Box marginTop={2} marginBottom={1}>
              <a
                style={{ color: "rgb(45,127,249)" }}
                href="https://www.tablemate.io/user/apis"
                target="_blank"
                rel="noreferrer noopener"
              >
                Find your TableMate API here.
              </a>
            </Box>
          )}
        </Box>

        <Box
          marginBottom={3}
          border="1px solid #d9d9d9;"
          borderRadius={5}
          padding={3}
          opacity={!disableFields ? "1" : ".4"}
        >
          <Text fontWeight="bold" marginTop={2} marginBottom={1}>
            Input Table
          </Text>
          {isHelpVisible && (
            <Text marginBottom={2}>
              1. Select a table from which you'd like to send a prompt to
              ChatGPT.
            </Text>
          )}
          <TablePickerSynced
            disabled={disableFields}
            globalConfigKey="inputTable"
          />

          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Input View
              </Text>
              {isHelpVisible && (
                <Text marginBottom={2}>
                  2. Select a view from that tablle from which you'd like to
                  send a prompt to ChatGPT.
                </Text>
              )}
              <ViewPickerSynced
                table={inputTable}
                disabled={disableFields}
                globalConfigKey="viewField"
                onChange={(newFieldId) => setInputFieldId(newFieldId)}
              />
            </>
          )}

          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Input Field
              </Text>
              {isHelpVisible && (
                <Text marginBottom={2}>
                  3. Select a field from that table and view from which you'd
                  like to send a prompt to ChatGPT. This can be a Single Line
                  Text, Multi-Line Text, or Formula field.
                </Text>
              )}
              <FieldPickerSynced
                table={inputTable}
                globalConfigKey="inputField"
                disabled={disableFields}
                allowedTypes={[
                  "singleLineText",
                  "multilineText",
                  "formula",
                  "richText",
                ]}
                onChange={(newFieldId) => setInputFieldId(newFieldId)}
              />
            </>
          )}

          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Ready to Send
              </Text>
              {isHelpVisible && (
                <Text marginBottom={2}>
                  4. Select a checkmark or formula field which will output
                  "True", "False", 1, or 0 to indicate which rows you would like
                  to send to ChatGPT.
                </Text>
              )}
              <FieldPickerSynced
                table={inputTable}
                globalConfigKey="checkmarkField"
                disabled={disableFields}
                allowedTypes={["checkbox", "formula"]}
                onChange={(newFieldId) => setInputFieldId(newFieldId)}
              />
            </>
          )}

          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Output Field
              </Text>
              {isHelpVisible && (
                <Text marginBottom={2}>
                  5. Select a table, view, and field from which you'd like to
                  send a prompt to ChatGPT.
                </Text>
              )}
              <FieldPickerSynced
                table={inputTable}
                globalConfigKey="outputField"
                disabled={disableFields}
                allowedTypes={["singleLineText", "multilineText", "richText"]}
                onChange={(newFieldId) => setOutputFieldId(newFieldId)}
              />
            </>
          )}
          <Box marginTop={3}>
            {isHelpVisible && (
              <Text marginBottom={2}>
                6. When all of the above fields are filled out, you've written
                your ChatGPT prompts into the Input Field, and you've checked
                off the corresponding rows with the Checkmark Field, press Run.
              </Text>
            )}
            <Button
              variant="primary"
              onClick={boundHandleSendRequest}
              disabled={disableFields}
            >
              Run ChatGPT
            </Button>
          </Box>
        </Box>
      </Box>
    </>
  );
};

const WrappedChatGPTExtension = () => (
  <ExtensionStateProvider>
    <ChatGPTExtension />
  </ExtensionStateProvider>
);

initializeBlock(() => <WrappedChatGPTExtension />);
