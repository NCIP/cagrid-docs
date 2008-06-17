package org.cagrid.hackathon.dcql;

import gov.nih.nci.cagrid.cqlresultset.CQLQueryResults;
import gov.nih.nci.cagrid.dcql.DCQLQuery;
import gov.nih.nci.cagrid.dcqlresult.DCQLQueryResultsCollection;
import gov.nih.nci.cagrid.fqp.processor.FederatedQueryEngine;
import gov.nih.nci.cagrid.fqp.processor.exceptions.FederatedQueryProcessingException;

/** 
 *  DCQLQueryRunner
 *  Executes a DCQL query using the client-side FQP APIs
 * 
 * @author David Ervin
 * 
 * @created Jun 16, 2008 12:21:22 PM
 * @version $Id: DCQLQueryRunner.java,v 1.2 2008-06-17 19:09:05 dervin Exp $ 
 */
public class DCQLQueryRunner {
    
    public static final String DCQL_QUERY_PROPERTY = "dcql.query.document";
    
    private DCQLQueryRunner() {
        // prevents instantiation
    }
    
    
    /**
     * Executes a DCQL query and returns results.  DCQL query results are compartmentalized
     * by the service from which they were retrieved.
     * 
     * @param query
     *      The query to execute
     * @return
     *      The results of the query
     * @throws FederatedQueryProcessingException
     *      An exception indicating an error in the execution of the DCQL query
     */
    public static DCQLQueryResultsCollection executeDcqlQuery(DCQLQuery query) throws FederatedQueryProcessingException {
        FederatedQueryEngine engine = new FederatedQueryEngine();
        DCQLQueryResultsCollection results = engine.execute(query);
        return results;
    }
    
    
    /**
     * Executes a DCQL query and aggregates the results as a single CQL query result.
     * Ordinarily, DCQL query results are comparementailzied by the service from which
     * they were retrieved.  In this case, they are aggregated as a single result.
     * 
     * @param query
     *      The query to execute
     * @return
     *      The results of the query
     * @throws FederatedQueryProcessingException
     *      An exception indicating an error in the execution of the DCQL query
     */
    public static CQLQueryResults executeAndAggregateQuery(DCQLQuery query) throws FederatedQueryProcessingException {
        FederatedQueryEngine engine = new FederatedQueryEngine();
        CQLQueryResults results = engine.executeAndAggregateResults(query);
        return results;
    }
    

    public static void main(String[] args) {
        // String queryFileName = null;
        if (args.length != 1) {
            System.err.println("USAGE: " + DCQLQueryRunner.class.getName() + " <dcql_query.xml>");
            System.exit(1);
        }
        String queryFileName = args[0];
        System.out.println("Executing query " + queryFileName);
        try {
            long start = System.currentTimeMillis();
            System.out.println("Loading query from disk");
            DCQLQuery query = QueryLoader.loadDcqlQuery(queryFileName);
            System.out.println("Query loaded in " + (System.currentTimeMillis() - start) + " ms");
            start = System.currentTimeMillis();
            System.out.println("Executing query");
            DCQLQueryResultsCollection results = executeDcqlQuery(query);
            System.out.println("Query executed in " + (System.currentTimeMillis() - start) + " ms");
            QueryResultPrinter.printDcqlQueryResults(results);
            System.out.println("DONE");
        } catch (FederatedQueryProcessingException ex) {
            ex.printStackTrace();
            System.exit(1);
        }
    }
}
