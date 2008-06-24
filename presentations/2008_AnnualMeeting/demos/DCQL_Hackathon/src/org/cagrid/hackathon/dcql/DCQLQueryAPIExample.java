package org.cagrid.hackathon.dcql;

import gov.nih.nci.cagrid.cqlresultset.CQLQueryResults;
import gov.nih.nci.cagrid.dcql.DCQLQuery;
import gov.nih.nci.cagrid.dcqlresult.DCQLQueryResultsCollection;
import gov.nih.nci.cagrid.fqp.processor.FederatedQueryEngine;
import gov.nih.nci.cagrid.fqp.processor.exceptions.FederatedQueryProcessingException;


/** 
 *  DCQLQueryAPIExample
 *  An example of using the DCQL object API to build up 
 *  and execute federated queries using the local
 *  FQP Client API
 * 
 * @author David Ervin
 * 
 * @created Jun 24, 2008 8:39:44 AM
 * @version $Id: DCQLQueryAPIExample.java,v 1.1 2008-06-24 12:51:32 dervin Exp $ 
 */
public class DCQLQueryAPIExample {
    
    private FederatedQueryEngine engine = null;
    private boolean aggregate = false;
    
    public DCQLQueryAPIExample() {
        /*
         * The FederatedQueryEngine is the heart of Federated Query Processing
         * on the grid.  A Federated Query Service uses this same API internally.
         * It is designed to be usable both in a grid service, and as a stand-alone
         * client side API, as we are using it here.
         */
        this.engine = new FederatedQueryEngine();
        
        /*
         * This flag controls how query results are produced.  Setting it to
         * true causes the query results to be aggregated into a CQL query result instance
         */
        this.aggregate = false;
    }
    
    
    private DCQLQuery createQuery() {
        DCQLQuery query = new DCQLQuery();
        
        /*
         * A DCQL query can be built up using the object model
         * here.  To execute properly, the query must be well-formed
         * and conform to the exposed domain model of each data service
         * it touches in the course of the query
         */
        
        return query;
    }
    
    
    public void runQuery() {
        DCQLQuery query = createQuery();
        Object queryResults = null;
        /*
         * Here, we can choose to use the engine to execute the query and return
         * a DCQL query results collection, or to have the engine aggregate the
         * query results into a standard CQL query result. 
         */
        try {
            if (aggregate) {
                queryResults = engine.executeAndAggregateResults(query);
            } else {
                queryResults = engine.execute(query);
            }
        } catch (FederatedQueryProcessingException ex) {
            /*
             * If execution reaches this point, an error has occured processing
             * the federated query.  The exception should tell what the problem was.
             */
            ex.printStackTrace();
            System.exit(1);
        }
        
        printResults(queryResults);
    }
    
    
    private void printResults(Object results) {
        if (results instanceof CQLQueryResults) {
            QueryResultPrinter.printCqlQueryResults((CQLQueryResults) results);
        } else if (results instanceof DCQLQueryResultsCollection) {
            QueryResultPrinter.printDcqlQueryResults((DCQLQueryResultsCollection) results);
        } else {
            System.err.println("UNABLE TO PRINT RESULTS OF TYPE " + results.getClass().getName());
        }
    }
    

    public static void main(String[] args) {
        DCQLQueryAPIExample example = new DCQLQueryAPIExample();
        example.runQuery();
    }
}
