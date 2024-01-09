/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable max-len */
// Airtable Extension: This component interfaces with Airtable to enable the TableMateGPTExtension capabilities. It mainly performs the interaction with the TableMate backend and with the GPT-3 API.
import React, { useState, useEffect, useRef } from "react"
import {
  useBase,
  Input,
  Select,
  Box,
  Text,
  Button,
  initializeBlock,
  useGlobalConfig,
  FieldPickerSynced,
  useCursor,
  Link
} from "@airtable/blocks/ui"
import "./styles.css"
import pLimit from "p-limit"

import { initializeApp } from "firebase/app"
// import { getAnalytics } from "firebase/analytics";
import { getFunctions, httpsCallable } from "firebase/functions"

// Firebase configuration: These are the settings required to establish a connection to the Firebase backend.
const firebaseConfig = {
  apiKey: "AIzaSyDDGxK9hAWDZuMZnsKodF6U5CdVtRyOaQ8",
  authDomain: "tablematetesting.firebaseapp.com",
  projectId: "tablematetesting",
  storageBucket: "tablematetesting.appspot.com",
  messagingSenderId: "94536164425",
  appId: "1:94536164425:web:566d0b0def93b58a3e8b98",
  measurementId: "G-CPYPF654FB"
};

const app = initializeApp(firebaseConfig)
// const analytics = getAnalytics(app);
const functions = getFunctions(app)

// TableMateGPTExtension component: This is the primary React component that orchestrates the whole process.
const TableMateGPTExtension = () => {
  const base = useBase()
  const cursor = useCursor()
  const globalConfig = useGlobalConfig()

  // State initializations: Here we are setting up state variables for various values that we need to keep track of in our component.
  // const [baseId, setBaseId] = useState(base.id)
  const baseId = base.id
  let inputFieldId, checkmarkFieldId, outputFieldId
  try {
    inputFieldId = globalConfig.get("inputField")
    checkmarkFieldId = globalConfig.get("checkmarkField")
    outputFieldId = globalConfig.get("outputField")
  } catch (error) {
    console.error("Error getting data from globalConfig: ", error)
  }
  const [currentRecordCount, setCurrentRecordCount] = useState(0)
  const [isBaseChecking, setIsBaseChecking] = useState(false)
  const [helpVisibility, setHelpVisibility] = useState(false)
  const [advancedVisibility, setAdvancedVisibility] = useState(false)
  const [baseAuthenticated, setBaseAuthenticated] = useState(false) // If this base is authenticated
  const [planActive, setPlanActive] = useState(false) // If the plan is active
  const [usedTrial, setUsedTrial] = useState(false) // If they already used their trial
  // const [displayedRecordCount, setDisplayedRecordCount] = useState(currentRecordCount);
  const displayedRecordCount = useRef(0)
  const [disableExtension, setDisableExtension] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingUserPermissions, setIsCheckingUserPermissions] = useState(false)
  const [processingDone, setProcessingDone] = useState(false)
  const [failedTasksCount, setFailedTasksCount] = useState(0)
  const isCancelled = useRef(false)
  const [canceling, setCanceling] = useState(false)
  const [logArray, setLogArray] = useState([])

  // Define the email address to be used in the reportProblem function.
  const emailAddress = "help@tablemate.io"

  // Debugging flag: If this is set to true, additional debugging information will be logged to the console.
  const debug = true // Set to false before releasing

  function customLog (...params) {
    if (debug) {
      console.log(...params)
    }
    setLogArray((prevLogs) => [...prevLogs, ...params])
  }

  // Default GPT Amounts
  const defaultTokens = 500
  const defaultTemperature = 1
  const defaultTopP = 0.75
  const defaultBestOf = 1
  const defaultGptModel = "gpt-4"

  // State initializations: Here we are setting up state variables for various values that we need to keep track of in our component.
  const inputTable = base.getTableByIdIfExists(cursor.activeTableId)
  const inputView = inputTable
    ? inputTable.getViewByIdIfExists(cursor.activeViewId)
    : null
  const inputField = inputTable
    ? inputTable.getFieldByIdIfExists(inputFieldId)
    : null
  const checkmarkField = inputTable
    ? inputTable.getFieldByIdIfExists(checkmarkFieldId)
    : null
  const outputField = inputTable
    ? inputTable.getFieldByIdIfExists(outputFieldId)
    : null

  // useEffect: This hook checks if the selected fields still exist in the active table, and if not, it resets the related global configurations.
  useEffect(() => {
    // Assuming cursor.activeTable is the currently selected Table object
    const table = cursor.activeTable
    try {
      if (inputFieldId && !table.getFieldByIdIfExists(inputFieldId)) {
        globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "inputField"), null)
      }
      if (outputFieldId && !table.getFieldByIdIfExists(outputFieldId)) {
        globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "outputField"), null)
      }
      if (checkmarkFieldId && !table.getFieldByIdIfExists(checkmarkFieldId)) {
        globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "checkmarkField"), null)
      }
    } catch (error) {
      console.error("Error in useEffect hook: ", error)
    }
  }, [inputFieldId, outputFieldId, checkmarkFieldId])
  //}, [inputFieldId, outputFieldId, checkmarkFieldId, cursor.activeTable, cursor.activeTableId, globalConfig])

  // checkUserPermissions function: This function checks if the current user has the required permissions to perform CRUD operations.
  const [userPermissions, setUserPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false
  })
  const checkUserPermissions = async () => {
    setIsCheckingUserPermissions(true)

    try {
      const table = base.getTableByIdIfExists(cursor.activeTableId)
      const canCreate = table.checkPermissionsForCreateRecord()
      const canUpdate = table.checkPermissionsForUpdateRecord()
      const canDelete = table.checkPermissionsForDeleteRecord()

      const permissions = {
        canCreate: canCreate.hasPermission,
        canUpdate: canUpdate.hasPermission,
        canDelete: canDelete.hasPermission
      }

      customLog("Checking user permissions")
      customLog("UserPermissions before:", userPermissions)
      setUserPermissions(permissions)
      customLog("UserPermissions after:", userPermissions)
    } catch (error) {
      console.error("Error checking user permissions: ", error)
    } finally {
      setIsCheckingUserPermissions(false)
    }
  }

  // checkBaseAccess function: This function checks if the base has permission to use the extension in the TableMate backend.
  const checkBaseAccess = async () => {
    setIsBaseChecking(true)
    try {
      customLog("Checking base access")
      const checkAccessFunction = httpsCallable(functions, "checkAccess")
      const result = await checkAccessFunction({ baseId })

      if (result.data.success) {
        customLog("Access allowed:", result.data.message)
        setCurrentRecordCount(result.data.currentRecordCount)
        displayedRecordCount.current = result.data.currentRecordCount

        customLog("Plan active actual status:,", result.data.planActive)
        customLog("Trying the logic with the plan:,", result.data.planActive !== null)
        customLog("Received result from checkAccess:", result.data)
        customLog("BaseAuthenticated before:", baseAuthenticated)
        customLog("Plan active before:", planActive)
        customLog("Used trial before:", usedTrial)
        // Set the planActive and usedTrial states based on the result data
        setPlanActive(result.data.planActive)
        setUsedTrial(result.data.usedTrial)
        setBaseAuthenticated(true)
        customLog("BaseAuthenticated after:", baseAuthenticated)
        customLog("Plan active after:", planActive)
        customLog("Used trial after:", usedTrial)
      } else {
        console.error("Access denied")
        setBaseAuthenticated(false)
      }
    } catch (error) {
      console.error("Error calling checkAccess function:", error)
      setBaseAuthenticated(false)
    } finally {
      setIsBaseChecking(false)
    }
  }

  // useEffect: This hook will call both checkBaseAccess and checkUserPermissions on component mount.
  useEffect(() => {
    customLog("Checking base access and user permissions")
    checkBaseAccess()
    checkUserPermissions()
  }, [])
  //}, [checkBaseAccess, checkUserPermissions])

  // useEffect: This hook will disable or enable the extension based on base access, user permissions, usedTrial and planActive.
  useEffect(() => {
    customLog("User permissions, base access, trial usage or plan status changed")
    customLog("UserPermissions:", userPermissions)
    customLog("BaseAuthenticated:", baseAuthenticated)
    customLog("UsedTrial:", usedTrial)
    customLog("PlanActive:", planActive)

    if (!baseAuthenticated ||
      !userPermissions.canCreate ||
      !userPermissions.canUpdate ||
      !userPermissions.canDelete ||
      (usedTrial && !planActive)) { // if usedTrial is true and planActive is false
      customLog("Disabling extension")
      setDisableExtension(true)
    } else {
      customLog("Enabling extension")
      setDisableExtension(false)
    }
  }, [baseAuthenticated, userPermissions, usedTrial, planActive]) // adding usedTrial and planActive to the dependency array
  //}, [baseAuthenticated, userPermissions, usedTrial, planActive]) // adding usedTrial and planActive to the dependency array

  // setRecordCount function: This function updates the record count on the server.
  useEffect(() => {
    globalConfig.setAsync("currentRecordCount", currentRecordCount)
    customLog("Current record count:", currentRecordCount)
  }, [currentRecordCount])
  // }, [currentRecordCount, globalConfig])
  const recordsProcessedThisRun = useRef(0)

  const setRecordCount = async (recordCount) => {
    try {
      customLog("Setting record count to:", recordCount)
      const updateTaskCount = httpsCallable(functions, "updateTaskCount")
      const result = await updateTaskCount({ baseId, newRecords: recordCount })
      if (result.data.message === "Skipped Stripe update for user without subscription details.") {
        // Handle this case specifically, maybe log a message or update the UI
        customLog("Received response from updateTaskCount:", result)
        customLog("Updated record count:", result.data.updatedRecordCount)
        customLog("Stripe update skipped for user without subscription details.")
      } else {
        setCurrentRecordCount(result.data.updatedRecordCount)
      }
    } catch (error) {
      if (error.details) {
        console.error("Detailed error:", error.details)
      }
    }
  }

  // updateTrialStatus function: This function updates the frontend and backend because the trial number has been reached
  const updateTrialStatus = async () => {
    setUsedTrial(true)
    const updateTrialStatusFunction = httpsCallable(functions, "updateTrialStatus")
    const trialStatusResult = await updateTrialStatusFunction({ customerId: baseId, usedTrial: true })
    customLog("Response from updateTrialStatus:", trialStatusResult)
  }

  // useEffect: This hook handles the process of updating the server about the number of records processed when the user exits the application.
  useEffect(() => {
    // Handler for beforeunload/unload events
    const handleExit = async () => {
      // Update the record count on server
      await setRecordCount(recordsProcessedThisRun.current)
    }

    // Add event listeners when the component mounts
    window.addEventListener("beforeunload", handleExit)
    window.addEventListener("unload", handleExit)

    // Remove event listeners when the component unmounts
    return () => {
      window.removeEventListener("beforeunload", handleExit)
      window.removeEventListener("unload", handleExit)
    }
  }, []) // Only run this effect once when the component mounts
  // }, [setRecordCount]) // Only run this effect once when the component mounts  

  // Initialize state variables
  const [maxTokens, setMaxTokens] = useState(defaultTokens)
  const [gptModel, setGptModel] = useState(defaultGptModel)
  // eslint-disable-next-line no-unused-vars
  const [temperature, setTemperature] = useState(defaultTemperature)
  // eslint-disable-next-line no-unused-vars
  const [topP, setTopP] = useState(defaultTopP)
  // eslint-disable-next-line no-unused-vars
  const [bestOf, setBestOf] = useState(defaultBestOf)

  useEffect(() => {
    try {
      const localGptModel = globalConfig.get(generateConfigKey(cursor.activeTableId, "gptModel")) || defaultGptModel
      const localMaxTokens = globalConfig.get(generateConfigKey(cursor.activeTableId, "maxTokens")) || defaultTokens
      const localTemperature = globalConfig.get(generateConfigKey(cursor.activeTableId, "temperature")) || defaultTemperature
      const localTopP = globalConfig.get(generateConfigKey(cursor.activeTableId, "topP")) || defaultTopP
      const localBestOf = globalConfig.get(generateConfigKey(cursor.activeTableId, "bestOf")) || defaultBestOf

      setGptModel(localGptModel)
      setMaxTokens(localMaxTokens)
      setTemperature(localTemperature)
      setTopP(localTopP)
      setBestOf(localBestOf)
    } catch (error) {
      console.error("An error occurred:", error)
    }
  }, [cursor.activeTableId, globalConfig])

  async function sendToGPT () {
    recordsProcessedThisRun.current = 0;
    isCancelled.current = false
    let errors = []; // Array to collect errors
    const allRecordsAlreadyProcessed = false // Add this line to introduce the flag

    const inputFieldKey = generateConfigKey(cursor.activeTableId, "inputField")
    const outputFieldKey = generateConfigKey(cursor.activeTableId, "outputField")
    const checkmarkFieldKey = generateConfigKey(cursor.activeTableId, "checkmarkField")

    const input = globalConfig.get(inputFieldKey)
    const output = globalConfig.get(outputFieldKey)
    const checkmark = globalConfig.get(checkmarkFieldKey)

    const inputRecordsResult = await inputView.selectRecordsAsync()
    const outputRecordsResult = await inputView.selectRecordsAsync()
    const inputRecords = inputRecordsResult.records
    const outputRecords = outputRecordsResult.records

    const temperatureValue =
      globalConfig.get(
        generateConfigKey(cursor.activeTableId, "temperature")
      ) || defaultTemperature
    customLog("temperatureValue:", temperatureValue)
    const temperature = parseFloat(temperatureValue)

    const topPValue =
      globalConfig.get(generateConfigKey(cursor.activeTableId, "topP")) ||
      defaultTopP
    customLog("topP:", topPValue)
    const topP = parseFloat(topPValue)

    const bestOfValue =
      globalConfig.get(generateConfigKey(cursor.activeTableId, "bestOf")) ||
      defaultBestOf
    customLog("bestOf:", bestOfValue)
    const bestOf = parseFloat(bestOfValue)

    if (
      !inputTable.getFieldByIdIfExists(input) ||
      !inputTable.getFieldByIdIfExists(output) ||
      !inputTable.getFieldByIdIfExists(checkmark)
    ) {
      alert("Please select the input, output, and checkmark fields.")
      return
    }

    // Checking for edge cases to make alerts
    const recordsToProcess = inputRecords.filter(record => record.getCellValue(checkmark) === true || record.getCellValue(checkmark) === 1)
    const recordsInvalidCheckmark = inputRecords.filter(record => ![true, false, 1, 0, null].includes(record.getCellValue(checkmark)))

    if (recordsInvalidCheckmark.length > 0) {
      alert("The 'Selected Rows' field may use a formula field, but must result in 1 or 0 result.")
      return
    }

    if (recordsToProcess.length === 0) {
      alert("No rows have their checkmark checked to be processed.")
      return
    }

    const limit = pLimit(10) // Set the concurrency limit.
    setIsLoading(true)

    const processRecord = async (inputRecord) => {
      // If the user presses the cancel button while running the tasks
      if (isCancelled.current) {
        return
      }

      // Check if the selected fields still exist in the table
      const checkmarkValue = inputRecord.getCellValue(checkmark)
      const outputRecord = outputRecords.find((record) => record.id === inputRecord.id)
      const outputResponseValue = outputRecord.getCellValue(output)
      const inputResponseValue = inputRecord.getCellValue(input)

      // If the record is already processed, simply return from the function
      if (checkmarkValue === true && outputResponseValue) {
        return
      }

      if ((checkmarkValue === true || checkmarkValue === 1) && !outputResponseValue && inputResponseValue) {
        const prompt = inputRecord.getCellValue(input)
        const requestBody = {
          prompt,
          max_tokens: maxTokens,
          model: gptModel,
          n: bestOf,
          stop: null,
          temperature,
          top_p: topP,
          baseId
        }

        try {
          customLog("Starting GPT tasks")
          customLog("Sending request to GPT with parameters:", {
            prompt,
            max_tokens: maxTokens,
            model: gptModel,
            n: bestOf,
            stop: null,
            temperature,
            top_p: topP,
            baseId
          })
          const callGPTFunction = httpsCallable(functions, "callGPT")

          const response = await callGPTFunction(requestBody)
          // If the user presses the cancel button while running the tasks
          if (isCancelled.current) {
            return
          }
          const chatGPTResponse = response.data.trim()
          customLog("Received response from GPT:", chatGPTResponse)

          await inputTable.updateRecordAsync(outputRecord, { [output]: chatGPTResponse })
          // If the user presses the cancel button while running the tasks
          if (isCancelled.current) {
            return
          }
          displayedRecordCount.current++
          recordsProcessedThisRun.current++

          // Check if totalRecordCount is more than or equal to 50 before starting a new task
          if (!planActive && displayedRecordCount.current >= 50) {
            customLog("Trial limit reached")
            updateTrialStatus()
            isCancelled.current = true
          }
        } catch (error) {
          console.error("Error calling GPT function:", error);
          errors.push(error);
          throw error;
        }
      }
    }

    try {
      const tasks = inputRecords.map((inputRecord) => limit(() => processRecord(inputRecord)))
      await Promise.all(tasks)

      // If no records were processed in this run, it means all marked records were already processed
      if (recordsProcessedThisRun.current === 0) {
        setIsLoading(false)
        alert("All records with checkmarks have already been processed.")
        return
      }
    } catch (error) {
      // Error handling when any record processing fails
      setIsLoading(false);
      if (errors.length > 0) {
        // Handle the first error
        const firstError = errors[0];
        if (firstError.code === "permission-denied") {
            alert("The GPT API Key saved on TableMate seems to be incorrect or no longer active.");
        } else {
            alert(`${firstError.message || "An unknown error occurred."}`);
        }
        return; // Exit the function early
      }
    }

    // If Canceled, update the UI
    if (isCancelled.current) {
      isCancelled.current = false
      setIsLoading(false)
      setCanceling(false)
      return
    }

    // After all tasks have been completed, we should ensure that the final count has been updated on the server
    if (recordsProcessedThisRun.current > 0) {
      // After all tasks have been completed, we should ensure that the final count has been updated on the server
      customLog("Incrementing recordsProcessedThisRun, new value:", recordsProcessedThisRun.current);
      await setRecordCount(recordsProcessedThisRun.current)
      customLog("Sending recordsProcessedThisRun to setRecordCount:", recordsProcessedThisRun.current);
      customLog("All tasks have been completed.")
    } else {
      if (!allRecordsAlreadyProcessed) { // Add this condition to check the flag
        alert("Unable to update the total records processed.")
      }
    }

    customLog("All tasks have been completed.")
    setIsLoading(false)
    setProcessingDone(true)
  }

  // useEffect: This hook clears the failed tasks count 5 seconds after loading has finished and there are failed tasks.
  useEffect(() => {
    let timerId

    if (!isLoading && failedTasksCount > 0) {
      timerId = setTimeout(() => setFailedTasksCount(0), 5000)
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId)
      }
    }
  }, [isLoading, failedTasksCount])

  // handleCancel function: If the user pressed the button to cancel the run, it stops the tasks and updates the task count on the server.
function handleCancel () {
  customLog("The job was canceled by the cancel button.");
  isCancelled.current = true;
  setCanceling(true);

  // Check if any records have been processed and update the server
  if (recordsProcessedThisRun.current > 0) {
      customLog("Updating server with processed record count:", recordsProcessedThisRun.current);
      setRecordCount(recordsProcessedThisRun.current).then(() => {
          customLog("Server updated with canceled task count.");
      }).catch(error => {
          console.error("Failed to update server with canceled task count:", error);
      });
  }
}


  // isFieldVisibleInView function: This function checks if a certain field is visible in the current view.
  // eslint-disable-next-line no-unused-vars
  const isFieldVisibleInView = (field) => {
    // Check if the field is included in the visibleFields array
    return true
  }

  // generateConfigKey function: This function generates a key for storing table-specific configurations in the globalConfig.
  const generateConfigKey = (tableId, fieldKey) => {
    return `table-${tableId}-${fieldKey}`
  }

  // Loader component: This is a small component that displays a loading spinner if the `loading` prop is true.
  // eslint-disable-next-line react/prop-types
  function Loader ({ loading }) {
    return loading
      ? (
      <Box marginRight={2} marginTop={1}>
        <img src="https://uploads-ssl.webflow.com/6412470803111e42c7b1d73b/65662d24ebd1a8cb7e48200f_daisy.gif" alt="Loading..." width="17px" height="17px" />
      </Box>
        )
      : null
  }
  
  // Re-sets the advanced model functionality
  const resetGPTParameters = () => {
    setGptModel(defaultGptModel);
    setMaxTokens(defaultTokens);
    setTemperature(defaultTemperature);
    setTopP(defaultTopP);
    setBestOf(defaultBestOf);

    // Resetting the values in globalConfig
    globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "gptModel"), defaultGptModel);
    globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "maxTokens"), defaultTokens);
    globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "temperature"), defaultTemperature);
    globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "topP"), defaultTopP);
    globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "bestOf"), defaultBestOf);
};


// Use these handlers in your Input components with the onChange prop
const handleMaxTokensChange = (e) => {
  const newValue = e.target.value;
  if (newValue === '' || (parseInt(newValue, 10) >= 1 && parseInt(newValue, 10) <= 32000)) {
    globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "maxTokens"), newValue);
    setMaxTokens(newValue);
  }
};

const handleTemperatureChange = (e) => {
  const newValue = e.target.value;
  if (newValue === '' || (parseFloat(newValue) >= 0 && parseFloat(newValue) <= 1)) {
    globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "temperature"), newValue);
    setTemperature(newValue);
  }
};

const handleTopPChange = (e) => {
  const newValue = e.target.value;
  if (newValue === '' || (parseFloat(newValue) >= 0 && parseFloat(newValue) <= 1)) {
    globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "topP"), newValue);
    setTopP(newValue);
  }
};

const handleBestOfChange = (e) => {
  const newValue = e.target.value;
  if (newValue === '' || (/^\d+$/.test(newValue) && parseInt(newValue, 10) >= 1 && parseInt(newValue, 10) <= 5)) {
    globalConfig.setAsync(generateConfigKey(cursor.activeTableId, "bestOf"), newValue);
    setBestOf(newValue);
  }
};

  // reportProblem: Gathers user/system info, prepares an email to support, and opens a mailto link.
  function reportProblem () {
    const userInfo = {
      "Base ID": baseId,
      "Input Field ID": inputFieldId,
      "Checkmark Field ID": checkmarkFieldId,
      "Output Field ID": outputFieldId,
      "Current Record Count": currentRecordCount,
      "Is Base Checking?": isBaseChecking,
      "Help Visibility": helpVisibility,
      "Advanced Visibility": advancedVisibility,
      "Is Base Authenticated?": baseAuthenticated,
      "Is Plan Active?": planActive,
      "Has User Used Trial?": usedTrial,
      "Displayed Record Count": displayedRecordCount.current,
      "Is Extension Disabled?": disableExtension,
      "Is Loading?": isLoading,
      "Is Checking User Permissions?": isCheckingUserPermissions,
      "Is Processing Done?": processingDone,
      "How many tasks failed?": failedTasksCount,
      "Is the task canceled?": isCancelled
    }

    const encodedLogs = encodeURIComponent(logArray.join("\n"))
    const userInfoString = encodeURIComponent(JSON.stringify(userInfo, null, 2))
    const issueDescription = "We're sorry you're having an issue. Please describe the problem and include any screenshots that may be helpful. We'll do our best to resolve it and get you back to work! Thanks for using TableMate. \n\n"
    const consoleLogLabel = "\n\nConsole log:\n"
    const userInfoLabel = "\n\nUser Info:\n"

    // We're going to remove getAuthenticatedUserId() as per your request
    const subject = `Help with Tablemate extension: Base: ${baseId}`
    const mailtoLink = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(issueDescription)}${encodeURIComponent(userInfoLabel)}${userInfoString}${encodeURIComponent(consoleLogLabel)}${encodedLogs}`

    window.location.href = mailtoLink
  }

  const options = [
    { value: "gpt-4", label: "GPT-4 (most sophisticated)" },
    { value: "gpt-3-turbo", label: "GPT-3 Turbo (fastest)" },
    { value: "gpt-3.5-turbo-16k", label: "GPT-3.5 Turbo 16K (fast and large output)" }
  ]

  // UI component: This is the Airtable extension frontend UI
  return (
    <>
      {!baseAuthenticated && ( // Should be "!baseAuthenticated" not "baseAuthenticated"
        <Box padding={3} paddingBottom={0}>
          <Box
            marginBottom={3}
            border="1px solid #d9d9d9;"
            borderRadius={5}
            padding={4}
            paddingTop={5}
            paddingBottom={5}
          >
            <Text
              fontSize={6}
              marginBottom={2}
              fontWeight="bold"
              lineHeight={1}
            >
              Welcome to TableMate GPT
            </Text>
            <Text fontSize={4} marginBottom={3}>
              Supercharge Airtable with AI
            </Text>
            <Text fontSize={2}>
              Get started quickly at
              <Link
                href="https://www.tablemate.io/signup-firebase"
                target="_blank"
                rel="noopener noreferrer"
                marginLeft={1}
                marginRight={1}
              >
                TableMate.io
              </Link>
              to connect GPT to all of your desired Airtable bases.
            </Text>
            <Box display="flex" marginTop={2} position="absolute">
              <Loader loading={isBaseChecking} />
              {isBaseChecking && (
                <Text marginTop="3px">Checking access...</Text>
              )}
            </Box>
          </Box>
        </Box>
      )}
      {!isCheckingUserPermissions &&
        (!userPermissions.canCreate ||
          !userPermissions.canUpdate ||
          !userPermissions.canDelete) && (
          <Box padding={3} paddingBottom={0}>
            <Box
              marginBottom={3}
              border="1px solid #d9d9d9;"
              borderRadius={5}
              padding={4}
              paddingTop={5}
              paddingBottom={5}
            >
              <Text fontSize={6} marginBottom={2} fontWeight="bold">
                Limited Base Permissions
              </Text>
              <Text fontSize={2}>
                Ask the Base owner for editor or creator permissions to use this
                extension.
              </Text>
            </Box>
          </Box>
      )}
      {usedTrial && !planActive && (
        <Box padding={3} paddingBottom={0}>
          <Box
            marginBottom={3}
            border="1px solid #d9d9d9;"
            borderRadius={5}
            padding={4}
            paddingTop={5}
            paddingBottom={5}
          >
            <Text fontSize={6} marginBottom={2} fontWeight="bold">
              Sign up for a Subscription
            </Text>
            <Text fontSize={4} marginBottom={3}>
              You used your 50 free tasks.
            </Text>
            <Text fontSize={2}>
              Easily sign up for a
              <Link
                href="https://www.tablemate.io/user/subscription"
                target="_blank"
                rel="noopener noreferrer"
                marginLeft={1}
                marginRight={1}
              >
                subscription
              </Link>
              for as little as $5 a month to continue using TableMate.
            </Text>
          </Box>
        </Box>
      )}
      <Box padding={3} opacity={!disableExtension ? "1" : "0.4"}>
        <Box display="flex" alignItems="center" marginTop={0} marginBottom={2}>
          <Box display="flex" alignItems="center" width="100%">
            <Text
              fontSize="3"
              paddingLeft={1}
              paddingRight={2}
              fontWeight="bold"
              marginTop={0}
              marginBottom={0}
            >
              TableMate GPT
            </Text>
            {disableExtension
              ? (
              <Box backgroundColor="" padding={1} borderRadius={3}>
                <Text style={{ color: "#11921e" }}></Text>
              </Box>
                )
              : (
              <Box backgroundColor="" padding={1} borderRadius={3}>
                <Text style={{ color: "#c4c7cd" }}></Text>
              </Box>
                )}
          </Box>
          <Button
            icon={helpVisibility ? "up" : "down"}
            aria-label="Toggle help text"
            size="small"
            variant="secondary"
            className="secondary"
            onClick={() => setHelpVisibility(!helpVisibility)}
          >
            {helpVisibility && "Hide Instructions"}
            {!helpVisibility && "Show Instructions"}
          </Button>
        </Box>
        {helpVisibility && (
          <Text
            marginBottom={2}
            backgroundColor="#F9F9F9"
            padding={3}
            fontStyle="italic"
          >
            Facing an issue? Reload the extension by clicking the dropdown to
            the top-left of the extension and pressing &quot;Reload extension&quot;.
          </Text>
        )}
        <Box
          marginBottom={3}
          border="1px solid #d9d9d9;"
          borderRadius={5}
          padding={3}
        >
          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={0} marginBottom={2}>
                Prompt
              </Text>
              {helpVisibility && (
                <Text
                  marginBottom={2}
                  backgroundColor="#F9F9F9"
                  padding={3}
                  fontStyle="italic"
                >
                  1. Prompt: Select a field from which you&apos;d like to send a
                  prompt to GPT. This can be a Single Line Text, Multi-Line
                  Text, or Formula field. We recommend using the &quot;concatenate()&quot;
                  formula to construct a prompt using several variables from
                  your column data. See our tutorials for more info and tips.
                </Text>
              )}
              <FieldPickerSynced
                table={inputTable}
                disabled={disableExtension}
                globalConfigKey={generateConfigKey(
                  cursor.activeTableId,
                  "inputField"
                )}
                allowedTypes={[
                  "singleLineText",
                  "multilineText",
                  "formula",
                  "richText"
                ]}
              />
              {!isFieldVisibleInView(inputField, inputView) && (
                <Text fontStyle="italic" color="warning" marginTop={1}>
                  This field is hidden in this view.
                </Text>
              )}
            </>
          )}

          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Response
              </Text>
              {helpVisibility && (
                <Text
                  marginBottom={2}
                  backgroundColor="#F9F9F9"
                  padding={3}
                  fontStyle="italic"
                >
                  2. Response: Select a field from which you&apos;d like to receive
                  the response from GPT. This can be a Single Line Text, or
                  Multi-Line Text field.
                </Text>
              )}
              <FieldPickerSynced
                table={inputTable}
                disabled={disableExtension}
                globalConfigKey={generateConfigKey(
                  cursor.activeTableId,
                  "outputField"
                )}
                allowedTypes={["singleLineText", "multilineText", "richText"]}
              />
              {!isFieldVisibleInView(outputField, inputView) && (
                <Text fontStyle="italic" color="warning" marginTop={1}>
                  This field is hidden in this view.
                </Text>
              )}
            </>
          )}
          {inputTable && (
            <>
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Selected Rows
              </Text>
              {helpVisibility && (
                <Text
                  marginBottom={2}
                  backgroundColor="#F9F9F9"
                  padding={3}
                  fontStyle="italic"
                >
                  3. Selected Rows: Select a checkmark or formula field which
                  will output &quot;True&quot;, &quot;False&quot;, 1, or 0 to indicate which rows to
                  send to GPT.
                </Text>
              )}
              <FieldPickerSynced
                table={inputTable}
                disabled={disableExtension}
                globalConfigKey={generateConfigKey(
                  cursor.activeTableId,
                  "checkmarkField"
                )}
                allowedTypes={["checkbox", "formula"]}
              />
              {!isFieldVisibleInView(checkmarkField, inputView) && (
                <Text fontStyle="italic" color="warning" marginTop={1}>
                  This field is hidden in this view.
                </Text>
              )}
            </>
          )}
          <Button
            marginTop={3}
            icon={advancedVisibility ? "up" : "down"}
            aria-label="Toggle help text"
            size="small"
            variant="secondary"
            className="secondary"
            onClick={() => setAdvancedVisibility(!advancedVisibility)}
          >
            {advancedVisibility && "Hide Advanced Settings"}
            {!advancedVisibility && "Show Advanced Settings"}
          </Button>
          {advancedVisibility && (
            <Box
              marginTop={3}
              borderTop="1px solid #d9d9d9;"
              paddingTop={2}
              paddingBottom={2}
              borderBottom="1px solid #d9d9d9;"
            >
              <Text fontWeight="bold" marginTop={2} marginBottom={2}>
                Advanced GPT Parameters
              </Text>
              <Text fontWeight="" marginBottom={1}>
                Model
              </Text>
              <Select
                marginBottom={2}
                value={gptModel}
                options={options}
                onChange={(newValue) => {
                  customLog("Selected Value:", newValue)
                  globalConfig.setAsync(
                    generateConfigKey(cursor.activeTableId, "gptModel"),
                    newValue
                  )
                  setGptModel(newValue)
                }}
                disabled={disableExtension}
              />
              <Box display="flex" marginBottom={2}>
                <Box marginRight={2} flexBasis="50%">
                  <Text fontWeight="" marginBottom={1}>
                    Max Tokens
                  </Text>
                  {helpVisibility && (
                    <Text
                      marginBottom={2}
                      backgroundColor="#F9F9F9"
                      padding={3}
                      fontStyle="italic"
                    >
                       The max length of your request and response. Different models have different max amounts. e.g. 4096 or 11K tokens.
                       <Link
                          href="https://platform.openai.com/tokenizer"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
                        >
                          See more.
                        </Link>
                    </Text>
                  )}
                  <Input
                    value={
                      globalConfig.get(
                        generateConfigKey(cursor.activeTableId, "maxTokens")
                      ) || ""
                    }
                    onChange={handleMaxTokensChange}
                    type="number"
                    min="1"
                    placeholder={`${defaultTokens}`}
                    disabled={disableExtension}
                  />
                </Box>
                <Box flexBasis="50%">
                  <Text fontWeight="" marginBottom={1}>
                    Temperature (0-1)
                  </Text>
                  {helpVisibility && (
                    <Text
                      marginBottom={2}
                      backgroundColor="#F9F9F9"
                      padding={3}
                      fontStyle="italic"
                    >
                       Controls randomness. Lower values give more predictable results. Higher values are more creative and diverse.
                    </Text>
                  )}
                  <Input
                    value={
                      globalConfig.get(
                        generateConfigKey(cursor.activeTableId, "temperature")
                      ) || ""
                    }
                    onChange={handleTemperatureChange}
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    placeholder={`${defaultTemperature}`}
                    disabled={disableExtension}
                  />
                </Box>
              </Box>
              <Box display="flex" marginBottom={1}>
                <Box marginRight={2} flexBasis="50%">
                  <Text fontWeight="" marginBottom={1}>
                    Top P (0-1)
                  </Text>
                  {helpVisibility && (
                    <Text
                      marginBottom={2}
                      backgroundColor="#F9F9F9"
                      padding={3}
                      fontStyle="italic"
                    >
                       Nucleus sampling dictates focus on probable results: higher values are less deterministic and more varied.
                    </Text>
                  )}
                  <Input
                    value={
                      globalConfig.get(
                        generateConfigKey(cursor.activeTableId, "topP")
                      ) || ""
                    }
                    onChange={handleTopPChange}
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    placeholder={`${defaultTopP}`}
                    disabled={disableExtension}
                  />
                </Box>
                <Box flexBasis="50%">
                  <Text fontWeight="" marginBottom={1}>
                    Best Of (1-5)
                  </Text>
                  {helpVisibility && (
                    <Text
                      marginBottom={2}
                      backgroundColor="#F9F9F9"
                      padding={3}
                      fontStyle="italic"
                    >
                      Each task repeats this many times and internally chooses the best response. Reptition can get expensive.
                    </Text>
                  )}
                  <Input
                    value={
                      globalConfig.get(
                        generateConfigKey(cursor.activeTableId, "bestOf")
                      ) || ""
                    }
                    onChange={handleBestOfChange}
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    placeholder={`${defaultBestOf}`}
                    disabled={disableExtension}
                  />
                </Box>
              </Box>
              <Button
                  onClick={resetGPTParameters}
                  variant="secondary"
                  className="secondary"
                  icon="reset"
                  marginTop={2}
                  marginBottom={2}
                  style={{ width: '100%' }}
                  aria-label="Reset GPT Parameters"
              >
                  Reset Parameters
              </Button>
            </Box>
          )}
          <Box marginTop={3}>
            {helpVisibility && (
              <Text
                marginBottom={2}
                backgroundColor="#F9F9F9"
                padding={3}
                fontStyle="italic"
              >
                When all of the above fields are filled out, you&apos;ve written your
                GPT prompts into the Input Field, and you&apos;ve checked off the
                corresponding rows with the Checkmark Field, press Run.
              </Text>
            )}
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              <Button
                disabled={disableExtension}
                variant={isLoading ? "secondary" : "primary"}
                onClick={isLoading ? handleCancel : sendToGPT}
              >
                {isLoading ? "Cancel Job" : "Run Tasks"}
              </Button>
              <Box>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  <Loader loading={isLoading} />
                  <Text textAlign="right">
                    {canceling
                      ? "Canceling..."
                      : planActive
                        ? `${displayedRecordCount.current} completed`
                        : `${displayedRecordCount.current}/50 free tasks`}
                  </Text>
                </Box>

                <Text
                  display={failedTasksCount > 0 ? "flex" : "none"}
                  textColor="#E3AA00"
                  fontStyle="italic"
                  textAlign="right"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  {failedTasksCount} tasks failed
                </Text>
              </Box>
            </Box>
          </Box>
          {helpVisibility && (
            <Box
              marginTop={3}
              padding={3}
              borderRadius={5}
              border="1px solid #d9d9d9;"
            >
              <Text fontWeight="bold" color marginTop={2} marginBottom={3}>
                Still facing an issue?
              </Text>
              <Text
                marginBottom={3}
                fontStyle="italic"
              >
                Sorry for the trouble. Click below to auto-generate a help
                email. Please describe your issue and attach helpful
                screenshots.
              </Text>
              <Link
                onClick={reportProblem}
                marginBottom={2}
                style={{
                  cursor: "pointer",
                  color: "007bff",
                  whiteSpace: "nowrap",
                  display: "inline-block"
                }}
              >
                Send a help email to support
              </Link>
            </Box>
          )}
          <Box marginTop={3} paddingTop={2} borderTop="1px solid #d9d9d9;">
            <Box
              display="flex"
              alignItems="center"
              marginTop={0}
              marginBottom={2}
              flexWrap="wrap"
            >
              <Link
                href="https://www.tablemate.io"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
              >
                Home
              </Link>
              <Text
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
                marginLeft={1}
                marginRight={1}
              >
                |
              </Text>
              <Link
                href="https://www.tablemate.io/user/get-started"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
              >
                Get Started
              </Link>
              <Text
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
                marginLeft={1}
                marginRight={1}
              >
                |
              </Text>
              <Link
                href="https://www.tablemate.io/tutorials"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
              >
                Tutorials
              </Link>
              <Text
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
                marginLeft={1}
                marginRight={1}
              >
                |
              </Text>
              <Link
                href="https://www.tablemate.io/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
              >
                Privacy
              </Link>
              <Text
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
                marginLeft={1}
                marginRight={1}
              >
                |
              </Text>
              <Link
                href="https://www.tablemate.io/terms"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#a0a0a0", whiteSpace: "nowrap" }}
              >
                Terms
              </Link>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  )
}

initializeBlock(() => <TableMateGPTExtension />)
