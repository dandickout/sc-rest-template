// Imports
const MongoClient = require("mongodb").MongoClient;
const merge = require('deepmerge');
  
//Get environmental variables
let MONGODB_URI = process.env.MONGO_URI;
let MONGODB = process.env.MONGODB;
let MONGODB_COLL = process.env.MONGODB_COLL;

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;

//support funtion that caches db connection to speed up warm starts
async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  // Connect to our MongoDB database hosted on MongoDB Atlas
  const client = await MongoClient.connect(MONGODB_URI);

  // Specify which database we want to use
  const db = await client.db(MONGODB);

  cachedDb = db;
  return db;
}

//====================================================================================================
//MAIN FUNCTION HANDLER
//====================================================================================================
exports.handler = async (event, context) => {
  /* By default, the callback waits until the runtime event loop is empty before freezing the process and returning the results to the caller. 
  Setting this property to false requests that AWS Lambda freeze the process soon after the callback is invoked, even if there are events in the event loop. 
  AWS Lambda will freeze the process, any state data, and the events in the event loop. 
  Any remaining events in the event loop are processed when the Lambda function is next invoked, if AWS Lambda chooses to use the frozen process. */
  context.callbackWaitsForEmptyEventLoop = false;

  //log the incoming event for troubleshooting
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  //set up a default response package
  let body;
    let statusCode = '200';
    const headers = {
        'Content-Type': 'application/json',
    };
  
  
  // Get an instance of our database
  try {
    var db = await connectToDatabase();    
  } 
  catch (error) {
    const errorString = "Error connection to database " + error.stack;
    console.error(errorString);
    let response = {
            statusCode: 500,
            body: JSON.stringify(errorString)
        };
    return response;
  }

  // ++ Parse incoming variables ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  try {

    //parse event body and deconstruct into variables
    let data = JSON.parse(event.body);
    //parse individual sections or nothing if no section was sent
    let {cust_org_data} = data || {};
    let {cust_org_prefs} = data || {};
    let {audit_trail} = data || {};
    let {user_id, cust_org_id} = data || {};
    let {cust_org_name, cust_org_email, cust_org_phone} = cust_org_data || {};

    body = {
      cust_org_id: cust_org_id,
      user_id : user_id,
      cust_org_data: cust_org_data,
      cust_org_prefs: cust_org_prefs,
      audit_trail: audit_trail
    }

    switch (event.httpMethod) {

      case 'POST':
            //these are all required for post
            if(!user_id || !cust_org_id || !cust_org_name || !cust_org_email || !cust_org_phone) {
              throw new Error(body.error = 'Missing required parameter')}
          break;

      case 'GET':
            //either of these can be used for
            if(!user_id && !cust_org_id) {
              throw new Error(body.error = 'Missing required parameter')}
          break;

      case 'PUT':
            //these are all optional for put
            if(!user_id || !cust_org_id) {
              throw new Error(body.error = 'Missing required parameter')}
          break;

      case 'DELETE':
            //Required
            if(!user_id || !cust_org_id) {
              throw new Error(body.error = 'Missing required parameter')}
          break;

      default:
          throw new Error(`Unsupported method "${event.httpMethod}"`);

    } 
  } catch (err) {
      statusCode = '400';
      body = err.message;
  } finally {
      body = JSON.stringify(body);
  }

  // ++ Process Prep ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

  const date = new Date(Date.now());
  //create template doc with placeholders for each section
  let template_doc = {
    cust_org_id: cust_org_id,
    user_id : user_id,
    cust_org_data: cust_org_data || {},
    cust_org_prefs: cust_org_prefs || {},
    audit_trail: audit_trail || {}
  };


  // ++ Process method ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  const def_query = {"cust_org_id": cust_org_id};

  try {
    switch (event.httpMethod) {
      case 'DELETE':
          body = await db.collection(MONGODB_COLL).deleteOne(def_query);
        break;

      case 'GET':
          if(cust_org_id){
            body = await db.collection(MONGODB_COLL).findOne(def_query);
          }
          else if(user_id){
            body = await db.collection(MONGODB_COLL).findOne({"user_id": user_id});
          }
        break;

    case 'POST':
          //Add initial onbaording stage
          template_doc.onboarding_stage = 1;
          //Add default preferences
          template_doc.cust_org_prefs = {
            emissions_output_units: "kg"
          }
          //get the current Date as ISO and log who and when record was created
          template_doc.audit_trail = {
            created_at: date.toISOString(),
            created_by: user_id
          }

          //insert the new document
          body = await db.collection(MONGODB_COLL).insertOne(template_doc);
        break;

    case 'PUT':
          //get the existing document to update only new or changed sections
          old_doc = await db.collection(MONGODB_COLL).findOne(def_query);
          //get the current Date as ISO and log who and when record was updated
          template_doc.audit_trail = {
            update_at: date.toISOString(),
            updated_by: user_id
          }

          //deepmerge the template with the existing doc
          new_doc = merge(old_doc, template_doc);
          delete new_doc['_id'];

          //update all fields in the document
          body = await db.collection(MONGODB_COLL).updateOne(def_query, {$set: new_doc});
        break;

        default:
            throw new Error(`Unsupported method "${event.httpMethod}"`);
    }
  } catch (err) {
      statusCode = '400';
      body = err.message;
  } finally {
      body = JSON.stringify(body);
  }
 
  return {
    statusCode,
    body,
    headers,
  };
    
};
