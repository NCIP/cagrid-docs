package gov.nih.nci.cagrid.data.cql.validation;

/**
 * 
 * DomainModelLoader interface will be implemented by concrete model loaders. Mode
 * Loaders will need to implement only one method that return a caDSR domain model.
 * All configuration for implementing model loaders should be done through their
 * constructors.
 * @version 1.0
 * @created 30-May-2006 4:41:07 PM
 */
public interface DomainModelLoader {

	/**
	 * 
	 * Can return exception if unable to load a domain model
	 */
	public DomainModel load();

}